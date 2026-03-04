type ProjectInviteTemplateInput = {
  appUrl: string;
  inviterDisplayName: string;
  projectName: string;
};

export type ProjectInviteTemplateResult = {
  subject: string;
  preheader: string;
  html: string;
  text: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildProjectInviteTemplate(
  input: ProjectInviteTemplateInput
): ProjectInviteTemplateResult {
  const inviterDisplayName = input.inviterDisplayName.trim();
  const projectName = input.projectName.trim();
  const appUrl = input.appUrl.trim();
  const subject = `You're invited to join ${projectName} on IdeaHome`;
  const preheader = "Open IdeaHome to access your project invite";

  const inviterHtml = escapeHtml(inviterDisplayName);
  const projectHtml = escapeHtml(projectName);
  const appUrlHtml = escapeHtml(appUrl);

  const text = [
    `You're invited to join ${projectName} on IdeaHome.`,
    "",
    `${inviterDisplayName} invited you to collaborate on "${projectName}".`,
    "",
    `Open IdeaHome: ${appUrl}`,
  ].join("\n");

  const html = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#0d0d0d;color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0d0d0d;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#171717;border:1px solid #2a2a2a;border-radius:12px;padding:28px 24px;">
            <tr>
              <td>
                <p style="margin:0 0 8px;color:#a3a3a3;font-size:12px;letter-spacing:0.06em;text-transform:uppercase;">IdeaHome</p>
                <h1 style="margin:0 0 14px;font-size:26px;line-height:1.25;color:#f5f5f5;">You're invited to join ${projectHtml}</h1>
                <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#e5e5e5;">
                  <strong style="color:#f5f5f5;">${inviterHtml}</strong> invited you to collaborate on
                  <strong style="color:#f5f5f5;">${projectHtml}</strong>.
                </p>
                <table role="presentation" cellspacing="0" cellpadding="0">
                  <tr>
                    <td>
                      <a href="${appUrlHtml}" style="display:inline-block;background:#60a5fa;color:#0b1220;text-decoration:none;font-weight:700;font-size:15px;padding:12px 18px;border-radius:8px;">Open IdeaHome</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:22px 0 0;font-size:12px;line-height:1.6;color:#a3a3a3;">
                  If the button does not work, copy and paste this URL into your browser:<br />
                  <a href="${appUrlHtml}" style="color:#93c5fd;text-decoration:underline;">${appUrlHtml}</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`.trim();

  return {
    subject,
    preheader,
    html,
    text,
  };
}
