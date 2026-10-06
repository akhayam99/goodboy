import { continueResolveLaunch } from './continueResolveLaunch';
import type { ContinueThreadsParams, GetFn } from './types';

type Params = { readonly get: GetFn } & ContinueThreadsParams;

export const continueResolveThreads = ({
  get,
  sessionId,
  threadIds,
  hint,
}: Params): Promise<void> =>
  continueResolveLaunch({
    get,
    sessionId,
    entries: threadIds.map((threadId) => ({ threadId, intent: 'retry' as const })),
    hint,
  });
