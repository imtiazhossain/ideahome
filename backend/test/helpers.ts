import * as jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const secret = process.env.JWT_SECRET || "dev-secret";

export function createTestToken(
  payload: { sub: string; email?: string } = {
    sub: "test-user-id",
    email: "test@example.com",
  }
): string {
  return jwt.sign(payload, secret, { expiresIn: "1h" });
}

/** Create a test user with a personal org; returns token and ids for e2e. */
export async function createTestUserWithOrg(prisma: PrismaClient) {
  const org = await prisma.organization.create({
    data: { name: `E2E Org ${Date.now()}` },
  });
  const user = await prisma.user.create({
    data: {
      email: `e2e-${Date.now()}@example.com`,
      organizationId: org.id,
    },
  });
  const token = createTestToken({ sub: user.id, email: user.email });
  return { token, userId: user.id, orgId: org.id };
}

/** Create a test user without an organization (e.g. to test guard ensuring org on first request). */
export async function createTestUserWithoutOrg(prisma: PrismaClient) {
  const user = await prisma.user.create({
    data: { email: `e2e-no-org-${Date.now()}@example.com` },
  });
  const token = createTestToken({ sub: user.id, email: user.email });
  return { token, userId: user.id };
}
