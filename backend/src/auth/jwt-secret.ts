export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv === "development" || nodeEnv === "test" || !nodeEnv) {
    return "dev-secret";
  }
  throw new Error("JWT_SECRET is required outside development/test");
}
