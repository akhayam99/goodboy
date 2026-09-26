import { recordHistoryEvent } from './recordHistoryEvent';
import type { GetFn, HistoryRunOrigin, HistoryStop, HistoryTarget, SetFn } from './types';

type Params = {
  readonly get: GetFn;
  readonly set: SetFn;
  readonly target: HistoryTarget;
  readonly origin: HistoryRunOrigin;
  readonly stop: HistoryStop;
  readonly planId: string | null;
};

export const historyStopTitle = ({
  origin,
  branch,
}: {
  readonly origin: HistoryRunOrigin;
  readonly branch: string;
}): string => (origin === 'rebase' ? `Couldn't rebase ${branch}` : `Rewrite of ${branch} stopped`);

export const reportHistoryStop = async ({
  get,
  target,
  origin,
  stop,
  planId,
}: Params): Promise<void> => {
  const agentId = get().historyRuns[target.mountId]?.agentId ?? null;
  await recordHistoryEvent({
    get,
    kind: 'history_stopped',
    target,
    origin,
    planId,
    extra: {
      reason: stop.reason,
      title: stop.message,
      files: stop.files,
      ...(agentId !== null && { agentId }),
    },
  });
  await get().reportError({
    title: historyStopTitle({ origin, branch: target.branch }),
    error: stop.message,
    severity: 'warning',
    sessionId: target.sessionId,
    action: { kind: 'open-activity', sessionId: target.sessionId },
  });
};
