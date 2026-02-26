/** Suppress Prisma "10th instance" warning in e2e tests (each test file boots its own AppModule). */
const originalWarn = console.warn;
console.warn = (...args: unknown[]) => {
  if (
    typeof args[0] === "string" &&
    args[0].includes("warn(prisma-client)") &&
    args[0].includes("instance")
  ) {
    return;
  }
  originalWarn.apply(console, args);
};
