import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { Request } from "express";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { OrganizationsService } from "./organizations.service";

@Controller("organizations")
@UseGuards(JwtAuthGuard)
export class OrganizationsController {
  constructor(private readonly svc: OrganizationsService) {}

  @Get()
  list(@Req() req: Request & { user?: { sub: string } }) {
    return this.svc.listForUser(req.user!.sub);
  }

  @Post()
  create(
    @Req() req: Request & { user?: { sub: string } },
    @Body() body: { name: string }
  ) {
    return this.svc.create(req.user!.sub, body);
  }

  @Post("ensure")
  ensure(@Req() req: Request & { user?: { sub: string } }) {
    return this.svc.ensureForUser(req.user!.sub);
  }
}
