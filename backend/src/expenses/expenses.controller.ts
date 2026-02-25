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
import { ExpensesService } from "./expenses.service";

@Controller("expenses")
@UseGuards(JwtAuthGuard)
export class ExpensesController {
  constructor(private readonly svc: ExpensesService) {}

  @Get()
  list(
    @Query("projectId") projectId: string,
    @Req() req: Request & { user?: { sub: string } }
  ) {
    return this.svc.list(projectId, req.user!.sub);
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
    @Req() req: Request & { user?: { sub: string } }
  ) {
    return this.svc.create(req.user!.sub, body);
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
}
