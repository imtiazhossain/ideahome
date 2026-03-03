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
import { JwtAuthGuard } from "../auth/jwt.guard";
import { AuthenticatedRequest, requireUserId } from "../auth/request-user";
import { ProjectsService } from "./projects.service";

@Controller("projects")
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private readonly svc: ProjectsService) {}

  @Get()
  list(@Req() req: AuthenticatedRequest) {
    return this.svc.list(requireUserId(req));
  }

  @Post()
  create(
    @Body() body: { name: string; organizationId?: string },
    @Req() req: AuthenticatedRequest
  ) {
    return this.svc.create(requireUserId(req), {
      name: body?.name,
    });
  }

  @Get(":id/members")
  listMembers(@Param("id") id: string, @Req() req: AuthenticatedRequest) {
    return this.svc.listMembers(id, requireUserId(req));
  }

  @Post(":id/members")
  inviteMember(
    @Param("id") id: string,
    @Body() body: { userId?: string },
    @Req() req: AuthenticatedRequest
  ) {
    return this.svc.inviteMember(id, requireUserId(req), body ?? {});
  }

  @Get(":id")
  get(@Param("id") id: string, @Req() req: AuthenticatedRequest) {
    return this.svc.get(id, requireUserId(req));
  }

  @Put(":id")
  update(
    @Param("id") id: string,
    @Body() body: { name?: string },
    @Req() req: AuthenticatedRequest
  ) {
    return this.svc.update(id, requireUserId(req), body ?? {});
  }

  @Delete(":id")
  remove(@Param("id") id: string, @Req() req: AuthenticatedRequest) {
    return this.svc.delete(id, requireUserId(req));
  }
}
