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
        ...extra,
      },
    })
    .catch(() => undefined);
};
