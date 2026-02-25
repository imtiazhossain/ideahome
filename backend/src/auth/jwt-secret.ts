export function getJwtSecret(): string {
  return process.env.JWT_SECRET ?? "dev-secret";
}
