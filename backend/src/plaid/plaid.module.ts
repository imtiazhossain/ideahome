import { Module } from "@nestjs/common";
import { PlaidController } from "./plaid.controller";
import { PlaidService } from "./plaid.service";
import { PrismaService } from "../prisma.service";

@Module({
  controllers: [PlaidController],
  providers: [PlaidService, PrismaService],
})
export class PlaidModule {}
