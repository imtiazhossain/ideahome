/**
 * Serverless entry point for Vercel. Creates NestJS app and returns Express handler.
 * Used by web/pages/api/[[...path]].ts to handle /api/* routes.
 */
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { json, urlencoded } from "express";
import type { Request, Response } from "express";
import { getJwtSecret } from "./auth/jwt-secret";
import { getCorsOptions } from "./common/cors";

let cachedApp: ReturnType<typeof createApp> | null = null;

async function createApp() {
  getJwtSecret();
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(json({ limit: "500mb" }));
  app.use(urlencoded({ extended: true, limit: "500mb" }));
  app.enableCors(getCorsOptions());
  await app.init();
  return app.getHttpAdapter().getInstance();
}

export async function getServerlessHandler() {
  if (cachedApp) return cachedApp;
  cachedApp = await createApp();
  return cachedApp;
}

export default async function handler(req: Request, res: Response) {
  const app = await getServerlessHandler();
  return app(req, res);
}
