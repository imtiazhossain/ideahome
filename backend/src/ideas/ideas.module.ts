import { Module } from "@nestjs/common";
import { IdeasController } from "./ideas.controller";
import { IdeasService } from "./ideas.service";
import { PrismaService } from "../prisma.service";
import { IdeaPlanService } from "./idea-plan.service";

@Module({
  controllers: [IdeasController],
  providers: [IdeasService, IdeaPlanService, PrismaService],
})
export class IdeasModule {}
