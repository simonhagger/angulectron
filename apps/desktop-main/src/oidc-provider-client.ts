export type DiscoveryDocument = {
  authorization_endpoint: string;
  token_endpoint: string;
  revocation_endpoint?: string;
  end_session_endpoint?: string;
};

export type OidcFetchOperation =
  | 'discovery'
  | 'token_exchange'
  | 'refresh'
  | 'revocation';

type OidcProviderClientOptions = {
  issuer: string;
  fetchFn?: typeof fetch;
};

export class OidcProviderClient {
  private readonly issuer: string;
  private readonly fetchFn: typeof fetch;
  private discoveryCache: DiscoveryDocument | null = null;

  constructor(options: OidcProviderClientOptions) {
    this.issuer = options.issuer;
    this.fetchFn = options.fetchFn ?? fetch;
  }

  async getDiscovery(timeoutMs: number): Promise<DiscoveryDocument> {
    if (this.discoveryCache) {
      return this.discoveryCache;
    }

    const response = await this.requestWithTimeout(
      `${this.issuer}/.well-known/openid-configuration`,
      {
        method: 'GET',
      },
      timeoutMs,
      'discovery',
    );

    if (!response.ok) {
      throw new Error(`OIDC discovery failed (${response.status}).`);
    }

    const payload = (await response.json()) as Partial<DiscoveryDocument>;
    if (!payload.authorization_endpoint || !payload.token_endpoint) {
      throw new Error('OIDC discovery payload is missing required endpoints.');
    }

    this.discoveryCache = {
      authorization_endpoint: payload.authorization_endpoint,
      token_endpoint: payload.token_endpoint,
      revocation_endpoint: payload.revocation_endpoint,
      end_session_endpoint: payload.end_session_endpoint,
    };

    return this.discoveryCache;
  }

  async requestWithTimeout(
    input: string,
    init: RequestInit,
    timeoutMs: number,
    operation: OidcFetchOperation,
  ): Promise<Response> {
    const abortController = new AbortController();
    const timeoutHandle = setTimeout(() => abortController.abort(), timeoutMs);
    try {
      return await this.fetchFn(input, {
        ...init,
        signal: abortController.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(
          `OIDC ${operation} request timed out after ${timeoutMs}ms.`,
        );
      }
      throw error;
    } finally {
      clearTimeout(timeoutHandle);
    }
  }
}
