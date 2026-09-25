import { upsertResolvePublicationThread } from '@goodboy/db';
import type { ResolvePublicationThread, SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { resolveThreadOnGithub } from '../github/resolveThreadOnGithub';
import type { ResolveStepPlan } from './resolveStepPlan';
import type { GetFn } from './types';

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
    await resolveThreadOnGithub({ get, sessionId, threadId });
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
