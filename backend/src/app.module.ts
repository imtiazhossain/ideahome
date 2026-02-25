import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./auth/auth.module";
import { ProjectsModule } from "./projects/projects.module";
import { IssuesModule } from "./issues/issues.module";
import { UsersModule } from "./users/users.module";
import { OrganizationsModule } from "./organizations/organizations.module";
import { TestsModule } from "./tests/tests.module";
import { TodosModule } from "./todos/todos.module";
import { IdeasModule } from "./ideas/ideas.module";
import { BugsModule } from "./bugs/bugs.module";
import { FeaturesModule } from "./features/features.module";
import { ExpensesModule } from "./expenses/expenses.module";
import { PrismaService } from "./prisma.service";

@Module({
  imports: [
    AuthModule,
    ProjectsModule,
    IssuesModule,
    UsersModule,
    OrganizationsModule,
    TestsModule,
    TodosModule,
    IdeasModule,
    BugsModule,
    FeaturesModule,
    ExpensesModule,
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
