import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { AuthenticatedRequest, requireUserId } from "../auth/request-user";
import { EmailService } from "../email/email.service";

@Controller("support")
@UseGuards(JwtAuthGuard)
export class SupportController {
  constructor(private readonly emailService: EmailService) {}

  @Post("error-report")
  @HttpCode(204)
  async reportError(
    @Body() body: { errorMessage?: string; pageUrl?: string },
    @Req() req: AuthenticatedRequest
  ): Promise<void> {
    const errorMessage = body?.errorMessage?.trim() ?? "";
    if (!errorMessage) {
      throw new BadRequestException("errorMessage is required");
    }

    await this.emailService.sendErrorReportEmail({
      reportedByUserId: requireUserId(req),
      reportedByEmail: req.user?.email?.trim() || "",
      errorMessage,
      pageUrl: body?.pageUrl?.trim(),
      userAgent: req.headers["user-agent"],
    });
  }
}
