/**
 * Catch-all API route that forwards to the NestJS backend when USE_BUILTIN_API is set.
 * Used for full Vercel deployment (Option C) where backend runs as serverless.
 */
import type { IncomingMessage } from "http";
import type { NextApiRequest, NextApiResponse } from "next";

const USE_BUILTIN_API = process.env.USE_BUILTIN_API === "true";

export const config = {
  api: { bodyParser: false },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (!USE_BUILTIN_API) {
    return res.status(404).json({ error: "Not found" });
  }

  const rawPath = req.query.path;
  const pathSegments = Array.isArray(rawPath)
    ? rawPath
    : typeof rawPath === "string"
      ? [rawPath]
      : [];
  const apiPath = "/" + pathSegments.join("/");
  const search = req.url?.includes("?") ? "?" + req.url.split("?")[1] : "";
  const pathForNest = apiPath + search;

  // Dynamically import to avoid loading NestJS when not using built-in API.
  // Backend is externalized in next.config so it's not bundled.
  // @ts-expect-error - backend/serverless resolved at runtime
  const { default: nestHandler } = await import("backend/serverless");

  // Mutate req so NestJS/Express receives the path without /api prefix
  const nodeReq = req as IncomingMessage & {
    url?: string;
    originalUrl?: string;
  };
  const savedUrl = nodeReq.url;
  const savedOriginalUrl = nodeReq.originalUrl;
  nodeReq.url = pathForNest;
  nodeReq.originalUrl = pathForNest;
  try {
    await new Promise<void>((resolve, reject) => {
      res.on("finish", () => resolve());
      res.on("close", () => resolve());
      res.on("error", reject);
      nestHandler(req, res as unknown as import("express").Response).catch(
        reject
      );
    });
  } finally {
    nodeReq.url = savedUrl;
    nodeReq.originalUrl = savedOriginalUrl;
  }
}
