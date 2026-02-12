export type OidcConfig = {
  issuer: string;
  clientId: string;
  redirectUri: string;
  scopes: string[];
  audience?: string;
};

const splitScopes = (value: string): string[] =>
  value
    .split(/[,\s]+/)
    .map((scope) => scope.trim())
    .filter((scope) => scope.length > 0);

export const loadOidcConfig = (
  env: NodeJS.ProcessEnv = process.env,
): OidcConfig | null => {
  const issuer = env.OIDC_ISSUER?.trim();
  const clientId = env.OIDC_CLIENT_ID?.trim();
  const redirectUri = env.OIDC_REDIRECT_URI?.trim();
  const scopeValue = env.OIDC_SCOPES?.trim();
  const audience = env.OIDC_AUDIENCE?.trim();

  if (!issuer && !clientId && !redirectUri && !scopeValue) {
    return null;
  }

  if (!issuer || !clientId || !redirectUri) {
    throw new Error(
      'OIDC configuration is incomplete. Required: OIDC_ISSUER, OIDC_CLIENT_ID, OIDC_REDIRECT_URI.',
    );
  }

  const scopes = splitScopes(scopeValue ?? 'openid profile email');
  if (!scopes.includes('openid')) {
    throw new Error('OIDC_SCOPES must include "openid".');
  }

  const normalizedIssuer = issuer.endsWith('/') ? issuer.slice(0, -1) : issuer;

  return {
    issuer: normalizedIssuer,
    clientId,
    redirectUri,
    scopes,
    audience: audience && audience.length > 0 ? audience : undefined,
  };
};
