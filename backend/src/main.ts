import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { json, urlencoded } from "express";
import { getCorsOptions } from "./common/cors";
import { loadEnvFromFileSystem } from "./common/load-env";

loadEnvFromFileSystem();

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const bodyLimit = process.env.BODY_LIMIT ?? "10mb";
  app.use(json({ limit: bodyLimit }));
  app.use(urlencoded({ extended: true, limit: bodyLimit }));
  app.enableCors(getCorsOptions());
  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`Backend listening on port ${port}`);
}

bootstrap();
