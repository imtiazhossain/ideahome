import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  Configuration,
  CountryCode,
  PlaidApi,
  PlaidEnvironments,
  Products,
} from "plaid";
import { getOrgIdForUser, verifyProjectInOrg } from "../common/org-scope";
import { PrismaService } from "../prisma.service";

const PLAID_ENV_MAP: Record<string, string> = {
  sandbox: PlaidEnvironments.sandbox,
  development: PlaidEnvironments.development,
  production: PlaidEnvironments.production,
};

@Injectable()
export class PlaidService {
  private client: PlaidApi | null = null;

  constructor(private readonly prisma: PrismaService) {}

  private getClient(): PlaidApi {
    if (this.client) return this.client;
    const clientId = process.env.PLAID_CLIENT_ID;
    const secret = process.env.PLAID_SECRET;
    const envName = (process.env.PLAID_ENV || "sandbox").toLowerCase();
    if (!clientId || !secret) {
      throw new BadRequestException(
        "Plaid is not configured. Set PLAID_CLIENT_ID and PLAID_SECRET."
      );
    }
    const basePath = PLAID_ENV_MAP[envName] ?? PlaidEnvironments.sandbox;
    const configuration = new Configuration({
      basePath,
      baseOptions: {
        headers: {
          "PLAID-CLIENT-ID": clientId,
          "PLAID-SECRET": secret,
        },
      },
    });
    this.client = new PlaidApi(configuration);
    return this.client;
  }

  private async getOrgIdForUser(userId: string): Promise<string> {
    return getOrgIdForUser(
      this.prisma,
      userId,
      new ForbiddenException(
        "User has no organization. Complete login again to create one."
      )
    );
  }

  private async verifyProjectAccess(
    projectId: string,
    userId: string
  ): Promise<void> {
    const orgId = await this.getOrgIdForUser(userId);
    await verifyProjectInOrg(this.prisma, projectId, orgId);
  }

  async createLinkToken(userId: string): Promise<{ linkToken: string }> {
    await this.getOrgIdForUser(userId);
    const client = this.getClient();
    const response = await client.linkTokenCreate({
      user: { client_user_id: userId },
      client_name: "Idea Home",
      language: "en",
      country_codes: [CountryCode.Us],
      products: [Products.Transactions],
    });
    const linkToken = response.data.link_token;
    if (!linkToken) {
      throw new BadRequestException("Plaid did not return a link token");
    }
    return { linkToken };
  }

  async exchangePublicToken(
    userId: string,
    publicToken: string
  ): Promise<{ itemId: string; institutionName?: string }> {
    if (!publicToken?.trim()) {
      throw new BadRequestException("public_token is required");
    }
    await this.getOrgIdForUser(userId);
    const client = this.getClient();
    const exchangeRes = await client.itemPublicTokenExchange({
      public_token: publicToken.trim(),
    });
    const accessToken = exchangeRes.data.access_token;
    const itemId = exchangeRes.data.item_id;
    if (!accessToken || !itemId) {
      throw new BadRequestException("Plaid exchange did not return access token");
    }
    let institutionName: string | null = null;
    try {
      const itemRes = await client.itemGet({ access_token: accessToken });
      institutionName =
        itemRes.data.item?.institution_id != null
          ? (itemRes.data.item as { institution_name?: string | null })
              .institution_name ?? null
          : null;
    } catch {
      // optional
    }
    await this.prisma.plaidItem.create({
      data: {
        userId,
        accessToken,
        itemId,
        institutionName,
      },
    });
    return {
      itemId,
      institutionName: institutionName ?? undefined,
    };
  }

  async listLinkedAccounts(userId: string): Promise<
    Array<{
      id: string;
      itemId: string;
      institutionName: string | null;
      createdAt: Date;
    }>
  > {
    await this.getOrgIdForUser(userId);
    const items = await this.prisma.plaidItem.findMany({
      where: { userId },
      select: {
        id: true,
        itemId: true,
        institutionName: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return items;
  }

  async renameLinkedAccount(
    userId: string,
    plaidItemId: string,
    institutionName: string | null
  ): Promise<{
    id: string;
    itemId: string;
    institutionName: string | null;
    createdAt: Date;
  }> {
    await this.getOrgIdForUser(userId);
    const existing = await this.prisma.plaidItem.findFirst({
      where: { id: plaidItemId, userId },
      select: {
        id: true,
        itemId: true,
        institutionName: true,
        createdAt: true,
      },
    });
    if (!existing) {
      throw new NotFoundException("Linked account not found");
    }
    const updated = await this.prisma.plaidItem.update({
      where: { id: plaidItemId },
      data: {
        institutionName,
      },
      select: {
        id: true,
        itemId: true,
        institutionName: true,
        createdAt: true,
      },
    });
    return updated;
  }

  async removeLinkedAccount(
    userId: string,
    plaidItemId: string
  ): Promise<void> {
    await this.getOrgIdForUser(userId);
    const item = await this.prisma.plaidItem.findFirst({
      where: { id: plaidItemId, userId },
    });
    if (!item) {
      throw new NotFoundException("Linked account not found");
    }
    await this.prisma.plaidItem.delete({
      where: { id: plaidItemId },
    });
  }

  async syncTransactions(
    userId: string,
    projectId: string
  ): Promise<{ added: number; lastSyncedAt: string | null }> {
    await this.verifyProjectAccess(projectId, userId);
    const items = await this.prisma.plaidItem.findMany({
      where: { userId },
    });
    if (items.length === 0) {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: { lastPlaidSyncAt: true },
      });
      return {
        added: 0,
        lastSyncedAt: project?.lastPlaidSyncAt?.toISOString() ?? null,
      };
    }
    const client = this.getClient();
    let totalAdded = 0;
    for (const item of items) {
      let cursor: string | undefined = item.transactionsCursor ?? undefined;
      let hasMore = true;
      while (hasMore) {
        const res = await client.transactionsSync({
          access_token: item.accessToken,
          cursor,
        });
        const data = res.data;
        const added = data.added ?? [];
        for (const tx of added) {
          const amount = tx.amount;
          if (typeof amount !== "number" || amount <= 0) continue;
          const dateStr =
            typeof tx.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(tx.date)
              ? tx.date
              : new Date().toISOString().slice(0, 10);
          const description =
            (tx.merchant_name ?? tx.name ?? "Transaction").trim() || "Transaction";
          const externalId = tx.transaction_id;
          if (!externalId) continue;
          const existing = await this.prisma.expense.findFirst({
            where: {
              projectId,
              source: "plaid",
              externalId,
            },
          });
          if (existing) continue;
          const pfc = tx.personal_finance_category;
          const category =
            pfc && typeof pfc === "object" && typeof (pfc as { primary?: string }).primary === "string"
              ? (pfc as { primary: string }).primary
              : "Other";
          await this.prisma.expense.create({
            data: {
              projectId,
              amount: Math.abs(amount),
              description,
              date: dateStr,
              category: category && category !== "undefined" ? category : "Other",
              source: "plaid",
              externalId,
            },
          });
          totalAdded += 1;
        }
        cursor = data.next_cursor ?? undefined;
        hasMore = data.has_more === true;
        if (cursor) {
          await this.prisma.plaidItem.update({
            where: { id: item.id },
            data: { transactionsCursor: cursor },
          });
        }
      }
    }
    const now = new Date();
    await this.prisma.project.update({
      where: { id: projectId },
      data: { lastPlaidSyncAt: now },
    });
    return { added: totalAdded, lastSyncedAt: now.toISOString() };
  }

  async getLastSync(
    userId: string,
    projectId: string
  ): Promise<{ lastSyncedAt: string | null }> {
    await this.verifyProjectAccess(projectId, userId);
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { lastPlaidSyncAt: true },
    });
    return {
      lastSyncedAt: project?.lastPlaidSyncAt?.toISOString() ?? null,
    };
  }
}
