import { Injectable } from "@nestjs/common";
import { Resend } from "resend";
import { buildProjectInviteTemplate } from "./templates/project-invite.template";

export class InviteEmailDeliveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InviteEmailDeliveryError";
  }
}

export class ErrorReportEmailDeliveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErrorReportEmailDeliveryError";
  }
}

type SendProjectInviteEmailInput = {
  to: string;
  inviterDisplayName: string;
  projectName: string;
  appUrl: string;
};

type SendErrorReportEmailInput = {
  reportedByUserId: string;
  reportedByEmail: string;
  errorMessage: string;
  userAgent?: string;
  pageUrl?: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

@Injectable()
export class EmailService {
  private isInviteEmailEnabled(): boolean {
    const raw = process.env.INVITE_EMAIL_ENABLED?.trim().toLowerCase();
    if (!raw) return true;
    return raw !== "false";
  }

  private getAppBaseUrl(): string {
    const base =
      process.env.FRONTEND_URL ??
      process.env.NEXT_PUBLIC_APP_URL ??
      "http://localhost:3000";
    const trimmed = base.trim();
    if (!trimmed) return "http://localhost:3000/";
    return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
  }

  private getFromAddress(): string {
    const fromAddress = process.env.INVITE_EMAIL_FROM?.trim();
    if (!fromAddress) {
      throw new InviteEmailDeliveryError("INVITE_EMAIL_FROM is required");
    }
    const fromName = process.env.INVITE_EMAIL_FROM_NAME?.trim() || "IdeaHome";
    return `${fromName} <${fromAddress}>`;
  }

  private createResendClient(): Resend {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (!apiKey) {
      throw new InviteEmailDeliveryError("RESEND_API_KEY is required");
    }
    return new Resend(apiKey);
  }

  private getErrorReportRecipientAddress(): string {
    const recipient =
      process.env.ERROR_REPORT_EMAIL_TO?.trim() ??
      process.env.INVITE_EMAIL_REPLY_TO?.trim() ??
      process.env.INVITE_EMAIL_FROM?.trim();
    if (!recipient) {
      throw new ErrorReportEmailDeliveryError(
        "ERROR_REPORT_EMAIL_TO (or invite email fallback) is required"
      );
    }
    return recipient;
  }

  async sendProjectInviteEmail(
    input: SendProjectInviteEmailInput
  ): Promise<void> {
    if (!this.isInviteEmailEnabled()) return;

    const resend = this.createResendClient();
    const from = this.getFromAddress();
    const replyTo = process.env.INVITE_EMAIL_REPLY_TO?.trim();
    const { subject, html, text } = buildProjectInviteTemplate({
      appUrl: input.appUrl.trim() || this.getAppBaseUrl(),
      inviterDisplayName: input.inviterDisplayName,
      projectName: input.projectName,
    });
    const result = await resend.emails.send({
      from,
      to: input.to,
      subject,
      html,
      text,
      ...(replyTo ? { replyTo } : {}),
    });
    if (result.error) {
      throw new InviteEmailDeliveryError(
        `Resend failed to send invite email: ${result.error.message ?? "Unknown error"}`
      );
    }
  }

  async sendErrorReportEmail(input: SendErrorReportEmailInput): Promise<void> {
    const resend = this.createResendClient();
    const from = this.getFromAddress();
    const to = this.getErrorReportRecipientAddress();
    const subject = `IdeaHome error report from ${input.reportedByEmail || input.reportedByUserId}`;
    const text = [
      "IdeaHome error report",
      "",
      `Reported by user id: ${input.reportedByUserId}`,
      `Reported by email: ${input.reportedByEmail || "unknown"}`,
      `Page URL: ${input.pageUrl?.trim() || "unknown"}`,
      `User agent: ${input.userAgent?.trim() || "unknown"}`,
      "",
      "Error message:",
      input.errorMessage.trim(),
    ].join("\n");
    const html = `<div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a">
<h2 style="margin:0 0 12px">IdeaHome error report</h2>
<p style="margin:0 0 6px"><strong>Reported by user id:</strong> ${escapeHtml(input.reportedByUserId)}</p>
<p style="margin:0 0 6px"><strong>Reported by email:</strong> ${escapeHtml(input.reportedByEmail || "unknown")}</p>
<p style="margin:0 0 6px"><strong>Page URL:</strong> ${escapeHtml(input.pageUrl?.trim() || "unknown")}</p>
<p style="margin:0 0 16px"><strong>User agent:</strong> ${escapeHtml(input.userAgent?.trim() || "unknown")}</p>
<p style="margin:0 0 6px"><strong>Error message:</strong></p>
<pre style="white-space:pre-wrap;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:10px">${escapeHtml(
      input.errorMessage.trim()
    )}</pre>
</div>`;
    const result = await resend.emails.send({
      from,
      to,
      subject,
      text,
      html,
      replyTo: input.reportedByEmail || undefined,
    });
    if (result.error) {
      throw new ErrorReportEmailDeliveryError(
        `Resend failed to send error report email: ${result.error.message ?? "Unknown error"}`
      );
    }
  }

  resolveInviteAppUrl(): string {
    return this.getAppBaseUrl();
  }
}
