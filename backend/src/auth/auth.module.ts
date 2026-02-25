import { Module, Global } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt.guard";
import { FirebaseService } from "./firebase.service";
import { PrismaService } from "../prisma.service";

@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, FirebaseService, JwtAuthGuard, PrismaService],
  exports: [AuthService, FirebaseService, JwtAuthGuard, PrismaService],
})
export class AuthModule {}
