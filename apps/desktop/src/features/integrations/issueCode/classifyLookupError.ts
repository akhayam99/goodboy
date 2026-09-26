export type LookupFailure =
  'not-found' | 'unauthorized' | 'forbidden' | 'rate-limited' | 'unreachable';

const messageOf = (error: unknown): string => {
  if (typeof error === 'string') {
    return error;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { readonly message: unknown }).message;
    return typeof message === 'string' ? message : '';
  }
  return '';
};

const kindOf = (error: unknown): string | null => {
  if (typeof error !== 'object' || error === null || !('kind' in error)) {
    return null;
  }
  const kind = (error as { readonly kind: unknown }).kind;
  return typeof kind === 'string' ? kind : null;
};

export const classifyLookupError = (error: unknown): LookupFailure => {
  const kind = kindOf(error);
  if (kind === 'not_found') {
    return 'not-found';
  }
  if (kind === 'auth' || kind === 'no_token') {
    return 'unauthorized';
  }
  const message = messageOf(error).toLowerCase();
  if (/\b429\b|rate limit|too many requests/.test(message)) {
    return 'rate-limited';
  }
  if (/\b401\b|unauthori[sz]ed|authentication failed/.test(message)) {
    return 'unauthorized';
  }
  if (/\b403\b|forbidden/.test(message)) {
    return 'forbidden';
  }
  if (
    /\b404\b|not found|could not resolve to an issue|missing issue|entity not found|does not exist/.test(
      message,
    )
  ) {
    return 'not-found';
  }
  return 'unreachable';
};
