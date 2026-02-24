import { Module, Global } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { PrismaService } from "../prisma.service";

@Global()
@Module({
  controllers: [AuthController],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class AuthModule {}
