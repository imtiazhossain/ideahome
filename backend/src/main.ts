import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { json, urlencoded } from "express";
import { join } from "path";
import * as express from "express";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(json({ limit: "500mb" }));
  app.use(urlencoded({ extended: true, limit: "500mb" }));
  app.enableCors();
  app.use("/uploads", express.static(join(__dirname, "..", "uploads")));
  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`Backend listening on port ${port}`);
}

bootstrap();
