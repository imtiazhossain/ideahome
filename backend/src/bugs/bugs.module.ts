import { Module } from "@nestjs/common";
import { BugsController } from "./bugs.controller";
import { BugsService } from "./bugs.service";
import { PrismaService } from "../prisma.service";

@Module({
  controllers: [BugsController],
  providers: [BugsService, PrismaService],
})
export class BugsModule {}
