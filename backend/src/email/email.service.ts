import { Injectable } from "@nestjs/common";
import { Resend } from "resend";
import { buildProjectInviteTemplate } from "./templates/project-invite.template";

export class InviteEmailDeliveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InviteEmailDeliveryError";
  }
}

type SendProjectInviteEmailInput = {
  to: string;
  inviterDisplayName: string;
  projectName: string;
  appUrl: string;
};

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

  resolveInviteAppUrl(): string {
    return this.getAppBaseUrl();
  }
}
