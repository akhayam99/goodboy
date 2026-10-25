import { hostFailureOf } from '../../../shared/lib/hostFailureOf';
import { CommandError } from '../../../shared/lib/invokeCommand';

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

type FailureParams = {
  readonly error: unknown;
};

const failureOf = ({ error }: FailureParams) =>
  error instanceof CommandError ? error.failure : hostFailureOf({ rejection: error });

export const classifyLookupError = (error: unknown): LookupFailure => {
  const failure = failureOf({ error });
  if (failure !== null) {
    switch (failure.kind) {
      case 'bad_credentials':
        return 'unauthorized';
      case 'denied':
        return 'forbidden';
      case 'not_found':
        return 'not-found';
      case 'rate_limited':
        return 'rate-limited';
      case 'network':
      case 'timeout':
        return 'unreachable';
      case 'failed':
        break;
      default: {
        const exhaustive: never = failure.kind;
        return exhaustive;
      }
    }
  }
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
