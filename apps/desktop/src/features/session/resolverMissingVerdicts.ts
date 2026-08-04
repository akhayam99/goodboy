import type { ResolverStatus } from './resolver-linkage';
import type { ResolverThreadSettlement } from './resolverThreadSettlements';

export type ResolverMissingVerdicts = {
  readonly threadIds: ReadonlyArray<string>;
  readonly sentence: string;
  readonly actionLabel: string;
};

type Params = {
  readonly settlements: ReadonlyArray<ResolverThreadSettlement>;
  readonly status: ResolverStatus;
  readonly isBusy: boolean;
};

const sentenceFor = ({
  missing,
  total,
}: {
  readonly missing: number;
  readonly total: number;
}): string => {
  if (total === 1) {
    return 'The agent stopped without saying what to do on this thread, so nothing can be posted yet.';
  }
  if (missing === total) {
    return `The agent stopped without saying what to do on any of its ${total} threads, so nothing can be posted yet.`;
  }
  return `The agent stopped without saying what to do on ${missing} of its ${total} threads, so those cannot be posted yet.`;
};

export const resolverMissingVerdicts = ({
  settlements,
  status,
  isBusy,
}: Params): ResolverMissingVerdicts | null => {
  if (isBusy || status === 'pending' || status === 'running' || status === 'resolved') {
    return null;
  }
  const threadIds = settlements
    .filter((settlement) => settlement.kind === 'open' && !settlement.isClosed)
    .map((settlement) => settlement.threadId);
  if (threadIds.length === 0) {
    return null;
  }
  return {
    threadIds,
    sentence: sentenceFor({ missing: threadIds.length, total: settlements.length }),
    actionLabel:
      threadIds.length === 1 ? 'Ask for the verdict' : `Ask for the ${threadIds.length} verdicts`,
  };
};
