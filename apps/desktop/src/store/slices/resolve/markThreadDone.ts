import { upsertResolvePublicationThread } from '@goodboy/db';
import type { ResolvePublicationThread, SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { reviewSourceFor } from '../review-source/reviewSourceFor';
import { providerThreadIdOf } from './resolveThreadSource';
import type { ResolveStepPlan } from './resolveStepPlan';
import type { GetFn } from './types';

const KEPT_THREAD_OPEN = 'The provider did not resolve the thread';

type ResolveParams = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly threadId: string;
};

const resolveOnSource = async ({ get, sessionId, threadId }: ResolveParams): Promise<void> => {
  const row = get().sessionResolveThreads[sessionId]?.find(
    (item) => item.threadId === threadId,
  ) ?? {
    threadId,
    originKind: 'review_comment' as const,
    sourceKind: undefined,
    providerThreadId: null,
    projectId: null,
    prNumber: null,
  };
  const result = await reviewSourceFor({ get, sessionId, row }).resolve({
    providerThreadId: providerThreadIdOf({ row }),
  });
  if (!result.isResolved) {
    throw new Error(KEPT_THREAD_OPEN);
  }
};

type Params = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly threadId: string;
  readonly frozen: ResolvePublicationThread;
  readonly plan: ResolveStepPlan;
};

export const markThreadDone = async ({
  get,
  sessionId,
  threadId,
  frozen,
  plan,
}: Params): Promise<ResolvePublicationThread> => {
  await upsertResolvePublicationThread({
    db: tauriDatabase,
    thread: { ...frozen, resolvePhase: 'resolving', error: null },
  });
  if (plan === 'resolve') {
    await resolveOnSource({ get, sessionId, threadId });
  }
  const closedAt = Date.now();
  const isResolvedOnGithub = plan === 'resolve';
  await get().updateResolveThread({
    sessionId,
    threadId,
    patch: {
      state: 'closed',
      githubResolved: isResolvedOnGithub,
      closedAt,
      closedSource: 'goodboy',
      stateReason: null,
    },
  });
  const receipt: ResolvePublicationThread = {
    ...frozen,
    resolvePhase: 'resolved',
    resolvedAt: isResolvedOnGithub ? closedAt : null,
    error: null,
  };
  await upsertResolvePublicationThread({ db: tauriDatabase, thread: receipt });
  return receipt;
};
