let __userinfoResponse: { sub?: string; email?: string; name?: string } = {
  sub: "mock-sub",
  email: "mock@example.com",
  name: "Mock User",
};

export function __setUserinfoResponse(r: {
  sub?: string;
  email?: string;
  name?: string;
}) {
  __userinfoResponse = r;
}

export class Issuer {
  static discover(): Promise<Issuer> {
    return Promise.resolve(new Issuer());
  }
  Client = class {
    constructor(_config: unknown) {}
    authorizationUrl(opts?: unknown): string {
      const state =
        opts && typeof opts === "object" && "state" in opts
          ? (opts as { state?: string }).state
          : undefined;
      if (!state) return "https://mock-auth.example/authorize";
      return `https://mock-auth.example/authorize?state=${encodeURIComponent(state)}`;
    }
    async callback(
      _redirectUri: string,
      _params: unknown,
      _opts?: unknown
    ): Promise<{ access_token: string }> {
      return { access_token: "mock-access-token" };
    }
    async userinfo(
      _accessToken: string
    ): Promise<{ sub?: string; email?: string; name?: string }> {
      return __userinfoResponse;
    }
  };
}

export const generators = {
  codeVerifier: () => "mock-verifier",
  codeChallenge: () => "mock-challenge",
  state: () => "mock-state",
};
