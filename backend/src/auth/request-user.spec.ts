import { UnauthorizedException } from "@nestjs/common";
import { requireUserId } from "./request-user";

describe("requireUserId", () => {
  it("returns trimmed user id when valid", () => {
    const req = { user: { sub: "  user-1  " } } as any;
    expect(requireUserId(req)).toBe("user-1");
  });

  it("throws when sub is missing", () => {
    expect(() => requireUserId({ user: {} } as any)).toThrow(
      UnauthorizedException
    );
  });

  it("throws when sub is blank", () => {
    expect(() => requireUserId({ user: { sub: "   " } } as any)).toThrow(
      UnauthorizedException
    );
  });

  it("throws when sub is not a string", () => {
    expect(() => requireUserId({ user: { sub: 123 } } as any)).toThrow(
      UnauthorizedException
    );
  });
});

