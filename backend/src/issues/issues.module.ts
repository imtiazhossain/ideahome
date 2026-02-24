import { Module } from "@nestjs/common";
import { IssuesService } from "./issues.service";
import { IssuesController } from "./issues.controller";
import { IssueCommentsService } from "./issue-comments.service";
import { PrismaService } from "../prisma.service";

@Module({
  controllers: [IssuesController],
  providers: [IssuesService, IssueCommentsService, PrismaService],
})
export class IssuesModule {}
