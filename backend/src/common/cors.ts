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
  // In dev, allow LAN origins (e.g. mobile WebView loading from http://192.168.x.x:3000)
  const lanOriginRegex =
    process.env.NODE_ENV === "production"
      ? null
      : /^https?:\/\/(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?$/;
  const origins = [...new Set([...fromEnv, ...frontend, ...localDefaults])];
  if (lanOriginRegex) return [...origins, lanOriginRegex];
  return origins;
}

export function getCorsOptions() {
  const allowedOrigins = resolveAllowedOrigins();
  return {
    origin: (
      origin: string | undefined,
      cb: (err: Error | null, allow?: boolean) => void
    ) => {
      if (!origin) {
        // Same-origin navigations and non-browser clients may omit Origin.
        return cb(null, true);
      }
      if (
        allowedOrigins.some((o) =>
          typeof o === "string" ? o === origin : o.test(origin)
        )
      ) {
        return cb(null, true);
      }
      // Deny CORS headers without throwing an application error.
      return cb(null, false);
    },
    credentials: true,
  };
}
