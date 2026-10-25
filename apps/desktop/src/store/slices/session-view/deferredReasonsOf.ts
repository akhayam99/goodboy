import type { SessionAttentionReason } from '@goodboy/types';
import type { StagePullRequest } from './attentionFactsOf';

type Params = {
  readonly dismissed: ReadonlySet<string> | undefined;
  readonly pr: StagePullRequest | null;
};

const NO_DEFERRALS: ReadonlySet<SessionAttentionReason> = new Set();

type MatchParams = {
  readonly dismissed: ReadonlySet<string>;
  readonly kind: string;
  readonly number: number;
};

const hasDismissed = ({ dismissed, kind, number }: MatchParams): boolean => {
  const prefix = `${kind}:`;
  const suffix = `:${number}`;
  for (const fingerprint of dismissed) {
    if (fingerprint.startsWith(prefix) && fingerprint.endsWith(suffix)) {
      return true;
    }
  }
  return false;
};

export const deferredReasonsOf = ({
  dismissed,
  pr,
}: Params): ReadonlySet<SessionAttentionReason> => {
  if (dismissed === undefined || dismissed.size === 0 || pr === null) {
    return NO_DEFERRALS;
  }
  const deferred = new Set<SessionAttentionReason>();
  if (hasDismissed({ dismissed, kind: 'fix-checks', number: pr.number })) {
    deferred.add('ci-failed');
  }
  if (hasDismissed({ dismissed, kind: 'merge-pr', number: pr.number })) {
    deferred.add('pr-approved');
  }
  return deferred.size === 0 ? NO_DEFERRALS : deferred;
};
