let __userinfoResponse: { email?: string; name?: string } = {
  email: "mock@example.com",
  name: "Mock User",
};

export function __setUserinfoResponse(r: { email?: string; name?: string }) {
  __userinfoResponse = r;
}

export class Issuer {
  static discover(): Promise<Issuer> {
    return Promise.resolve(new Issuer());
  }
  Client = class {
    constructor(_config: unknown) {}
    authorizationUrl(_opts?: unknown): string {
      return "https://mock-auth.example/authorize";
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
    ): Promise<{ email?: string; name?: string }> {
      return __userinfoResponse;
    }
  };
}

export const generators = {
  codeVerifier: () => "mock-verifier",
  codeChallenge: () => "mock-challenge",
  state: () => "mock-state",
};
