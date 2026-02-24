import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./auth/auth.module";
import { ProjectsModule } from "./projects/projects.module";
import { IssuesModule } from "./issues/issues.module";
import { UsersModule } from "./users/users.module";
import { OrganizationsModule } from "./organizations/organizations.module";
import { TestsModule } from "./tests/tests.module";
import { PrismaService } from "./prisma.service";

@Module({
  imports: [
    AuthModule,
    ProjectsModule,
    IssuesModule,
    UsersModule,
    OrganizationsModule,
    TestsModule,
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
