import { Module } from "@nestjs/common";
import { IdeasController } from "./ideas.controller";
import { IdeasService } from "./ideas.service";
import { PrismaService } from "../prisma.service";
import { IdeaPlanService } from "./idea-plan.service";
import { WebSearchService } from "./web-search.service";

@Module({
  controllers: [IdeasController],
  providers: [IdeasService, IdeaPlanService, WebSearchService, PrismaService],
})
export class IdeasModule {}
