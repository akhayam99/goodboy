export type GhFailureKind = 'denied' | 'auth' | 'rate-limited' | 'network' | 'failed';

export const GH_CERTIFICATE_MARKERS: ReadonlyArray<string> = [
  'x509',
  'certificate',
  'unknown authority',
];

export const GH_NETWORK_MARKERS: ReadonlyArray<string> = [
  'dial tcp',
  'no such host',
  'could not resolve host',
  'temporary failure in name resolution',
  'network is unreachable',
  'network is down',
  'connection refused',
  'connection reset',
  'i/o timeout',
  'tls handshake',
  'proxyconnect',
  'error connecting to',
  'check your internet connection',
  'githubstatus.com',
];

export const GH_RATE_LIMIT_MARKERS: ReadonlyArray<string> = [
  'rate limit',
  'abuse detection',
  'http 429',
  '429 too many requests',
];

export const GH_EXPIRED_MARKERS: ReadonlyArray<string> = ['expired', 'revoked', 'has been deleted'];

export const GH_MISSING_SCOPE_MARKERS: ReadonlyArray<string> = [
  'missing required scopes',
  'insufficient scope',
  'resource not accessible',
  'saml enforcement',
  'must grant your',
];

export const GH_BAD_CREDENTIALS_MARKERS: ReadonlyArray<string> = [
  'bad credentials',
  'http 401',
  '401 unauthorized',
  'requires authentication',
  'invalid token',
  'is invalid',
];

type Params = {
  readonly stderr: string;
};

export const classifyGhFailure = ({ stderr }: Params): GhFailureKind => {
  const haystack = stderr.toLowerCase();
  const matches = ({ markers }: { readonly markers: ReadonlyArray<string> }): boolean =>
    markers.some((marker) => haystack.includes(marker));
  if (matches({ markers: GH_CERTIFICATE_MARKERS }) || matches({ markers: GH_NETWORK_MARKERS })) {
    return 'network';
  }
  if (matches({ markers: GH_RATE_LIMIT_MARKERS })) {
    return 'rate-limited';
  }
  if (matches({ markers: GH_EXPIRED_MARKERS })) {
    return 'auth';
  }
  if (matches({ markers: GH_MISSING_SCOPE_MARKERS })) {
    return 'denied';
  }
  if (matches({ markers: GH_BAD_CREDENTIALS_MARKERS })) {
    return 'auth';
  }
  return 'failed';
};
