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
import { Request } from "express";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { TodosService } from "./todos.service";

@Controller("todos")
@UseGuards(JwtAuthGuard)
export class TodosController {
  constructor(private readonly svc: TodosService) {}

  @Get()
  list(
    @Query("projectId") projectId: string,
    @Req() req: Request & { user?: { sub: string } }
  ) {
    return this.svc.list(projectId, req.user!.sub);
  }

  @Post()
  create(
    @Body() body: { projectId: string; name: string; done?: boolean },
    @Req() req: Request & { user?: { sub: string } }
  ) {
    return this.svc.create(req.user!.sub, body);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() body: { name?: string; done?: boolean; order?: number },
    @Req() req: Request & { user?: { sub: string } }
  ) {
    return this.svc.update(id, req.user!.sub, body);
  }

  @Delete(":id")
  remove(
    @Param("id") id: string,
    @Req() req: Request & { user?: { sub: string } }
  ) {
    return this.svc.remove(id, req.user!.sub);
  }

  @Post("reorder")
  reorder(
    @Body() body: { projectId: string; todoIds: string[] },
    @Req() req: Request & { user?: { sub: string } }
  ) {
    return this.svc.reorder(body.projectId, req.user!.sub, body.todoIds);
  }
}
