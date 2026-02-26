export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv === "test") {
    return "test-jwt-secret";
  }
  if (
    nodeEnv !== "production" &&
    process.env.ALLOW_INSECURE_JWT_SECRET_DEV === "true"
  ) {
    return "dev-secret";
  }
  throw new Error("JWT_SECRET is required");
}
