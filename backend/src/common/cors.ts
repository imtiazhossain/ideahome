type CorsOrigin = string | RegExp;

function splitOrigins(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function resolveAllowedOrigins(): CorsOrigin[] {
  const fromEnv = splitOrigins(process.env.CORS_ORIGIN);
  const frontend = [process.env.FRONTEND_URL, process.env.NEXT_PUBLIC_APP_URL]
    .map((v) => (v ?? "").trim())
    .filter(Boolean);
  const localDefaults =
    process.env.NODE_ENV === "production"
      ? []
      : [
          "http://localhost:3000",
          "http://127.0.0.1:3000",
          "http://localhost:3001",
          "http://127.0.0.1:3001",
        ];
  return [...new Set([...fromEnv, ...frontend, ...localDefaults])];
}

export function getCorsOptions() {
  const allowedOrigins = resolveAllowedOrigins();
  return {
    origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.some((o) => (typeof o === "string" ? o === origin : o.test(origin)))) {
        return cb(null, true);
      }
      return cb(new Error("Origin not allowed by CORS"), false);
    },
    credentials: true,
  };
}
