import type { ResolveThread } from '@goodboy/types';
import { continueResolveLaunch } from './continueResolveLaunch';
import { attemptsOfLaunch } from './resolveLaunch';
import type { GetFn, RetryCouldntFixParams } from './types';

type Params = { readonly get: GetFn } & RetryCouldntFixParams;

const isRunFailure = ({ thread }: { readonly thread: ResolveThread }): boolean =>
  thread.state === 'failed' && thread.stateReason?.startsWith('publication_failed:') !== true;

export const retryCouldntFix = async ({
  get,
  sessionId,
  launchId,
  threadIds,
  hint,
}: Params): Promise<void> => {
  const state = get();
  const launch = attemptsOfLaunch({
    attempts: state.sessionResolveAttempts[sessionId] ?? [],
    launchKey: launchId,
  });
  const attemptIds = new Set(launch.map((attempt) => attempt.id));
  const wanted = (state.sessionResolveThreads[sessionId] ?? []).filter(
    (thread) =>
      thread.activeAttemptId !== null &&
      attemptIds.has(thread.activeAttemptId) &&
      isRunFailure({ thread }) &&
      (threadIds === undefined || threadIds.includes(thread.threadId)),
  );
  if (wanted.length === 0) {
    return;
  }
  await continueResolveLaunch({
    get,
    sessionId,
    entries: wanted.map((thread) => ({ threadId: thread.threadId, intent: 'retry' as const })),
    ...(hint !== undefined && { hint }),
  });
};
