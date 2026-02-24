declare module "openid-client" {
  interface ClientConstructor {
    new (config: any): any;
  }
  export function __setUserinfoResponse(r: {
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
