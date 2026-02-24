import { Module } from "@nestjs/common";
import { IssuesService } from "./issues.service";
import { IssuesController } from "./issues.controller";
import { IssueCommentsService } from "./issue-comments.service";
import { PrismaService } from "../prisma.service";
import { StorageService } from "../storage.service";

@Module({
  controllers: [IssuesController],
  providers: [IssuesService, IssueCommentsService, PrismaService, StorageService],
})
export class IssuesModule {}
