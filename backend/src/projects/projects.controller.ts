import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Request } from "express";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { ProjectsService } from "./projects.service";

@Controller("projects")
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private readonly svc: ProjectsService) {}

  @Get()
  list(@Req() req: Request & { user?: { sub: string } }) {
    return this.svc.list(req.user!.sub);
  }

  @Get(":id")
  get(
    @Param("id") id: string,
    @Req() req: Request & { user?: { sub: string } }
  ) {
    return this.svc.get(id, req.user!.sub);
  }

  @Post()
  create(
    @Body() body: { name: string; organizationId?: string },
    @Req() req: Request & { user?: { sub: string } }
  ) {
    return this.svc.create(req.user!.sub, { name: body.name });
  }

  @Put(":id")
  update(
    @Param("id") id: string,
    @Body() body: { name?: string },
    @Req() req: Request & { user?: { sub: string } }
  ) {
    return this.svc.update(id, req.user!.sub, body);
  }

  @Delete(":id")
  remove(
    @Param("id") id: string,
    @Req() req: Request & { user?: { sub: string } }
  ) {
    return this.svc.delete(id, req.user!.sub);
  }
}
