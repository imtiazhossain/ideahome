import { Module } from "@nestjs/common";
import { EmailModule } from "../email/email.module";
import { SupportController } from "./support.controller";

@Module({
  imports: [EmailModule],
  controllers: [SupportController],
})
export class SupportModule {}
