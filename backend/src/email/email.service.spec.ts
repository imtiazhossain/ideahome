import { EmailService, InviteEmailDeliveryError } from "./email.service";

const mockSend = jest.fn();
const mockResendCtor = jest.fn((_apiKey?: string) => ({
  emails: {
    send: mockSend,
  },
}));

jest.mock("resend", () => ({
  Resend: function MockedResend(apiKey: string) {
    return mockResendCtor(apiKey);
  },
}));

describe("EmailService", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.RESEND_API_KEY = "re_test_123";
    process.env.INVITE_EMAIL_FROM = "no-reply@example.com";
    process.env.INVITE_EMAIL_FROM_NAME = "IdeaHome";
    delete process.env.INVITE_EMAIL_ENABLED;
    mockSend.mockResolvedValue({ data: { id: "email_123" } });
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("sends invite email with expected payload", async () => {
    const service = new EmailService();
    await service.sendProjectInviteEmail({
      to: "invitee@example.com",
      inviterDisplayName: "Rocky",
      projectName: "Roadmap",
      appUrl: "https://ideahome.vercel.app/",
    });

    expect(mockResendCtor).toHaveBeenCalledWith("re_test_123");
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "IdeaHome <no-reply@example.com>",
        to: "invitee@example.com",
        subject: "You're invited to join Roadmap on IdeaHome",
      })
    );
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining("#0d0d0d"),
        text: expect.stringContaining("Open IdeaHome"),
      })
    );
  });

  it("does not send when invite emails are disabled", async () => {
    process.env.INVITE_EMAIL_ENABLED = "false";
    const service = new EmailService();
    await service.sendProjectInviteEmail({
      to: "invitee@example.com",
      inviterDisplayName: "Rocky",
      projectName: "Roadmap",
      appUrl: "https://ideahome.vercel.app/",
    });

    expect(mockResendCtor).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("throws when required env vars are missing", async () => {
    delete process.env.RESEND_API_KEY;
    const service = new EmailService();
    await expect(
      service.sendProjectInviteEmail({
        to: "invitee@example.com",
        inviterDisplayName: "Rocky",
        projectName: "Roadmap",
        appUrl: "https://ideahome.vercel.app/",
      })
    ).rejects.toThrow(InviteEmailDeliveryError);
  });

  it("throws typed error when provider returns an error", async () => {
    mockSend.mockResolvedValue({
      error: { name: "application_error", message: "Provider unavailable" },
    });
    const service = new EmailService();
    await expect(
      service.sendProjectInviteEmail({
        to: "invitee@example.com",
        inviterDisplayName: "Rocky",
        projectName: "Roadmap",
        appUrl: "https://ideahome.vercel.app/",
      })
    ).rejects.toThrow(InviteEmailDeliveryError);
  });
});
