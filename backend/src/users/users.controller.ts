import { Body, Controller, Get, Put, Req, UseGuards } from "@nestjs/common";
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

  @Get("me/appearance")
  getAppearance(@Req() req: AuthenticatedRequest) {
    return this.svc.getAppearancePreferences(requireUserId(req));
  }

  @Put("me/appearance")
  updateAppearance(
    @Req() req: AuthenticatedRequest,
    @Body() body: { lightPreset?: unknown; darkPreset?: unknown }
  ) {
    return this.svc.updateAppearancePreferences(requireUserId(req), body);
  }
}
