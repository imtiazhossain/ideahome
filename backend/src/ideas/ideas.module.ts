import { Module } from "@nestjs/common";
import { CodeService } from "../code/code.service";
import { IdeasController } from "./ideas.controller";
import { IdeasService } from "./ideas.service";
import { PrismaService } from "../prisma.service";
import { IdeaPlanService } from "./idea-plan.service";
import { WebSearchService } from "./web-search.service";
import { WeatherService } from "./weather.service";

@Module({
  controllers: [IdeasController],
  providers: [
    IdeasService,
    IdeaPlanService,
    WebSearchService,
    WeatherService,
    PrismaService,
    CodeService,
  ],
})
export class IdeasModule {}
