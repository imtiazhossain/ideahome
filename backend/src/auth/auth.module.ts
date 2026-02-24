import { Module, Global } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt.guard";
import { PrismaService } from "../prisma.service";

@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, PrismaService],
  exports: [PrismaService, JwtAuthGuard],
})
export class AuthModule {}
