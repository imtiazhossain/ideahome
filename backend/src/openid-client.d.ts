declare module "openid-client" {
  interface TokenSet {
    access_token?: string;
    id_token?: string;
  }

  interface UserInfoResponse {
    sub?: string;
    email?: string;
    name?: string;
  }

  interface ClientInstance {
    authorizationUrl(params: Record<string, unknown>): string;
    callback(
      redirectUri: string,
      params: Record<string, string>,
      checks: Record<string, string>
    ): Promise<TokenSet>;
    userinfo(accessToken: string): Promise<UserInfoResponse>;
  }

  interface ClientConstructor {
    new (config: Record<string, unknown>): ClientInstance;
  }
  export function __setUserinfoResponse(r: {
    sub?: string;
    email?: string;
    name?: string;
  }): void;
  export class Issuer {
    static discover(url: string): Promise<Issuer>;
    Client: ClientConstructor;
  }
  export const generators: {
    codeVerifier: () => string;
    codeChallenge: (verifier: string) => string;
    state: () => string;
  };
}
