import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { AuthenticatedRequest, requireUserId } from "../auth/request-user";
import { OrganizationsService } from "./organizations.service";

@Controller("organizations")
@UseGuards(JwtAuthGuard)
export class OrganizationsController {
  constructor(private readonly svc: OrganizationsService) {}

  @Get()
  list(@Req() req: AuthenticatedRequest) {
    return this.svc.listForUser(requireUserId(req));
  }

  @Post()
  create(
    @Req() req: AuthenticatedRequest,
    @Body() body: { name: string }
  ) {
    return this.svc.create(requireUserId(req), body ?? {});
  }

  @Post("ensure")
  ensure(@Req() req: AuthenticatedRequest) {
    return this.svc.ensureForUser(requireUserId(req));
  }
}
