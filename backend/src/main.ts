import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { json, urlencoded } from "express";
import { join } from "path";
import * as express from "express";
import type { NextFunction, Request, Response } from "express";
import * as jwt from "jsonwebtoken";
import { getJwtSecret } from "./auth/jwt-secret";
import { getCorsOptions } from "./common/cors";

async function bootstrap() {
  const jwtSecret = getJwtSecret();
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const bodyLimit = process.env.BODY_LIMIT ?? "10mb";
  app.use(json({ limit: bodyLimit }));
  app.use(urlencoded({ extended: true, limit: bodyLimit }));
  app.enableCors(getCorsOptions());
  app.use("/uploads", (req: Request, res: Response, next: NextFunction) => {
    const auth = req.headers["authorization"] ?? req.headers["Authorization"];
    const parts =
      typeof auth === "string" ? auth.split(" ") : Array.isArray(auth) ? auth[0]?.split(" ") : [];
    const headerToken = parts?.length === 2 && parts[0] === "Bearer" ? parts[1] : "";
    const queryToken =
      typeof req.query.access_token === "string" ? req.query.access_token.trim() : "";
    const token = headerToken || queryToken;
    if (!token) {
      res.status(401).json({ message: "Missing access token" });
      return;
    }
    try {
      jwt.verify(token, jwtSecret);
      next();
    } catch {
      res.status(401).json({ message: "Invalid or expired token" });
    }
  });
  app.use("/uploads", express.static(join(__dirname, "..", "uploads")));
  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`Backend listening on port ${port}`);
}

bootstrap();
