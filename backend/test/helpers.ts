import * as jwt from "jsonwebtoken";

const secret = process.env.JWT_SECRET || "dev-secret";

export function createTestToken(
  payload: { sub: string; email?: string } = {
    sub: "test-user-id",
    email: "test@example.com",
  }
): string {
  return jwt.sign(payload, secret, { expiresIn: "1h" });
}
