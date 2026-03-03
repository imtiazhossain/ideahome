import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Patch,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { AuthenticatedRequest, requireUserId } from "../auth/request-user";
import { PlaidService } from "./plaid.service";

@Controller("plaid")
@UseGuards(JwtAuthGuard)
export class PlaidController {
  constructor(private readonly plaid: PlaidService) {}

  @Post("link-token")
  createLinkToken(@Req() req: AuthenticatedRequest) {
    return this.plaid.createLinkToken(requireUserId(req));
  }

  @Post("exchange")
  exchange(
    @Body() body: { public_token?: string },
    @Req() req: AuthenticatedRequest
  ) {
    return this.plaid.exchangePublicToken(
      requireUserId(req),
      body?.public_token ?? ""
    );
  }

  @Get("linked-accounts")
  listLinkedAccounts(@Req() req: AuthenticatedRequest) {
    return this.plaid.listLinkedAccounts(requireUserId(req));
  }

  @Patch("linked-accounts/:id")
  renameLinkedAccount(
    @Param("id") id: string,
    @Body() body: { institutionName?: string | null },
    @Req() req: AuthenticatedRequest
  ) {
    if (!id?.trim()) {
      throw new BadRequestException("id is required");
    }
    const name = body?.institutionName;
    if (name !== undefined && name !== null && typeof name !== "string") {
      throw new BadRequestException("institutionName must be a string or null");
    }
    return this.plaid.renameLinkedAccount(
      requireUserId(req),
      id.trim(),
      typeof name === "string" ? name : null
    );
  }

  @Delete("linked-accounts/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  removeLinkedAccount(
    @Param("id") id: string,
    @Req() req: AuthenticatedRequest
  ): Promise<void> {
    if (!id?.trim()) {
      throw new BadRequestException("id is required");
    }
    return this.plaid.removeLinkedAccount(requireUserId(req), id.trim());
  }

  @Post("sync")
  sync(
    @Query("projectId") projectId: string,
    @Req() req: AuthenticatedRequest
  ) {
    if (!projectId?.trim()) {
      throw new BadRequestException("projectId is required");
    }
    return this.plaid.syncTransactions(requireUserId(req), projectId.trim());
  }

  @Get("last-sync")
  getLastSync(
    @Query("projectId") projectId: string,
    @Req() req: AuthenticatedRequest
  ) {
    if (!projectId?.trim()) {
      throw new BadRequestException("projectId is required");
    }
    return this.plaid.getLastSync(requireUserId(req), projectId.trim());
  }
}
