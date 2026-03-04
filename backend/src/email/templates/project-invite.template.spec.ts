import { buildProjectInviteTemplate } from "./project-invite.template";

describe("buildProjectInviteTemplate", () => {
  it("builds subject, html, and text with invite details", () => {
    const result = buildProjectInviteTemplate({
      appUrl: "https://ideahome.vercel.app/",
      inviterDisplayName: "Rocky",
      projectName: "Roadmap",
    });

    expect(result.subject).toBe("You're invited to join Roadmap on IdeaHome");
    expect(result.preheader).toBe(
      "Open IdeaHome to access your project invite"
    );
    expect(result.html).toContain("Rocky");
    expect(result.html).toContain("Roadmap");
    expect(result.html).toContain("https://ideahome.vercel.app/");
    expect(result.text).toContain(
      "Open IdeaHome: https://ideahome.vercel.app/"
    );
  });

  it("uses dark style tokens and escapes HTML", () => {
    const result = buildProjectInviteTemplate({
      appUrl: "https://example.com/",
      inviterDisplayName: "<script>alert(1)</script>",
      projectName: "Alpha & Beta",
    });

    expect(result.html).toContain("#0d0d0d");
    expect(result.html).toContain("#171717");
    expect(result.html).toContain("#2a2a2a");
    expect(result.html).toContain("#60a5fa");
    expect(result.html).not.toContain("<script>alert(1)</script>");
    expect(result.html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(result.html).toContain("Alpha &amp; Beta");
  });
});
