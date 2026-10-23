import { isPrePushFailure } from '../../shared/lib/isPrePushFailure';

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

type IsPrePushMessageParams = {
  readonly message: string | undefined;
};

const isPrePushMessage = ({ message }: IsPrePushMessageParams): boolean =>
  message !== undefined && isPrePushFailure({ message });

export const historyStopCause = ({ reason, message }: Params): string | null => {
  if (reason === undefined) {
    return null;
  }
  if (reason === 'push-failed') {
    return isPrePushMessage({ message }) ? 'hook stopped the push' : 'push failed';
  }
  return CAUSES[reason] ?? null;
};
