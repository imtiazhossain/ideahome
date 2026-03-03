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
  Res,
  UseGuards,
} from "@nestjs/common";
import { Response } from "express";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { AuthenticatedRequest, requireUserId } from "../auth/request-user";
import { TaxDocumentsService } from "./tax-documents.service";

@Controller("tax-documents")
@UseGuards(JwtAuthGuard)
export class TaxDocumentsController {
  constructor(private readonly svc: TaxDocumentsService) {}

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
      projectId?: unknown;
      fileName?: unknown;
      fileBase64?: unknown;
      kind?: unknown;
      taxYear?: unknown;
      notes?: unknown;
      textPreview?: unknown;
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
      kind?: unknown;
      taxYear?: unknown;
      notes?: unknown;
      textPreview?: unknown;
    },
    @Req() req: AuthenticatedRequest
  ) {
    return this.svc.update(id, requireUserId(req), body ?? {});
  }

  @Delete(":id")
  remove(@Param("id") id: string, @Req() req: AuthenticatedRequest) {
    return this.svc.remove(id, requireUserId(req));
  }

  @Get(":id/download")
  download(
    @Param("id") id: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response
  ) {
    return this.svc.download(id, requireUserId(req), res);
  }
}
