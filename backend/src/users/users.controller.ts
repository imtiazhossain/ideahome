import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { AuthenticatedRequest, requireUserId } from "../auth/request-user";
import { UsersService } from "./users.service";

@Controller("users")
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly svc: UsersService) {}

  @Get()
  list(@Req() req: AuthenticatedRequest) {
    return this.svc.list(requireUserId(req));
  }
}
