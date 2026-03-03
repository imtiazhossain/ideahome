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
import { PlaidModule } from "./plaid/plaid.module";
import { CodeModule } from "./code/code.module";
import { TaxDocumentsModule } from "./tax-documents/tax-documents.module";
import { PrismaService } from "./prisma.service";
import { MalwareScannerService } from "./malware-scanner.service";

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
    TaxDocumentsModule,
    PlaidModule,
    CodeModule,
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService, MalwareScannerService],
})
export class AppModule {}
