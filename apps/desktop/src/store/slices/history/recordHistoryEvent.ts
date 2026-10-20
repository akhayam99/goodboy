import type { SessionEventKind, SessionEventPayload } from '@goodboy/types';
import type { GetFn, HistoryRunOrigin, HistoryTarget } from './types';

type HistoryEventKind = Extract<SessionEventKind, `history_${string}`>;

type Params = {
  readonly get: GetFn;
  readonly kind: HistoryEventKind;
  readonly target: HistoryTarget;
  readonly origin: HistoryRunOrigin;
  readonly planId: string | null;
  readonly extra?: SessionEventPayload;
};

export const recordHistoryEvent = async ({
  get,
  kind,
  target,
  origin,
  planId,
  extra,
}: Params): Promise<void> => {
  const run = get().historyRuns[target.mountId];
  const batchId =
    origin === 'rebase' && run?.origin === 'rebase' && run.sessionId === target.sessionId
      ? (run.batchId ?? null)
      : null;
  await get()
    .recordSessionEvent({
      sessionId: target.sessionId,
      kind,
      payload: {
        mountId: target.mountId,
        projectId: target.projectId,
        projectName: target.projectName,
        worktreePath: target.worktreePath,
        branch: target.branch,
        origin,
        ...(planId !== null && { planId }),
        ...(batchId !== null && { batchId }),
        ...extra,
      },
    })
    .catch(() => undefined);
};
