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
import { ExpensesService } from "./expenses.service";

@Controller("expenses")
@UseGuards(JwtAuthGuard)
export class ExpensesController {
  constructor(private readonly svc: ExpensesService) {}

  @Get()
  list(
    @Query("projectId") projectId: string,
    @Req() req: AuthenticatedRequest
  ) {
    return this.svc.list(projectId, requireUserId(req));
  }

  @Post()
  create(
    @Body()
    body: {
      projectId: string;
      amount: number;
      description: string;
      date: string;
      category?: string;
    },
    @Req() req: AuthenticatedRequest
  ) {
    return this.svc.create(requireUserId(req), body ?? {});
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body()
    body: {
      amount?: number;
      description?: string;
      date?: string;
      category?: string;
    },
    @Req() req: AuthenticatedRequest
  ) {
    return this.svc.update(id, requireUserId(req), body ?? {});
  }

  @Delete("imported")
  deleteAllImported(
    @Query("projectId") projectId: string,
    @Req() req: AuthenticatedRequest
  ) {
    return this.svc.removeAllImported(projectId, requireUserId(req));
  }

  @Delete(":id")
  remove(@Param("id") id: string, @Req() req: AuthenticatedRequest) {
    return this.svc.remove(id, requireUserId(req));
  }
}
