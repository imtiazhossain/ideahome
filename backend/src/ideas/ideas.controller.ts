import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { AuthenticatedRequest, requireUserId } from "../auth/request-user";
import { IdeasService } from "./ideas.service";

@Controller("ideas")
@UseGuards(JwtAuthGuard)
export class IdeasController {
  constructor(private readonly svc: IdeasService) {}

  @Get()
  list(
    @Query("projectId") projectId: string,
    @Query("search") search: string | undefined,
    @Req() req: AuthenticatedRequest
  ) {
    return this.svc.list(projectId, requireUserId(req), search);
  }

  @Post()
  create(
    @Body() body: { projectId: string; name: string; done?: boolean },
    @Req() req: AuthenticatedRequest
  ) {
    return this.svc.create(requireUserId(req), body ?? {});
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() body: { name?: string; done?: boolean; order?: number },
    @Req() req: AuthenticatedRequest
  ) {
    return this.svc.update(id, requireUserId(req), body ?? {});
  }

  @Delete(":id")
  remove(
    @Param("id") id: string,
    @Req() req: AuthenticatedRequest
  ) {
    return this.svc.remove(id, requireUserId(req));
  }

  @Post("reorder")
  reorder(
    @Body() body: { projectId: string; ideaIds: string[] },
    @Req() req: AuthenticatedRequest
  ) {
    const payload = body ?? {};
    return this.svc.reorder(
      payload.projectId,
      requireUserId(req),
      payload.ideaIds
    );
  }
}
