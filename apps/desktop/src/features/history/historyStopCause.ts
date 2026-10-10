type Params = {
  readonly reason: string | undefined;
  readonly message: string | undefined;
};

const CAUSES: Readonly<Record<string, string>> = {
  dirty: 'uncommitted files',
  stuck: 'needs you',
  unverified: 'result differs',
  invalid: 'result differs',
  'origin-moved': 'origin moved',
  'head-moved': 'branch moved',
  'no-provider': 'no provider',
  blocked: 'blocked',
  failed: 'failed',
};

type IsHookMessageParams = {
  readonly message: string | undefined;
};

const isHookMessage = ({ message }: IsHookMessageParams): boolean =>
  message !== undefined && message.toLowerCase().includes('hook');

export const historyStopCause = ({ reason, message }: Params): string | null => {
  if (reason === undefined) {
    return null;
  }
  if (reason === 'push-failed') {
    return isHookMessage({ message }) ? 'hook stopped the push' : 'push failed';
  }
  return CAUSES[reason] ?? null;
};
