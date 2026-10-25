import { markHistoryPlan } from '@goodboy/db';
import type { MountId, SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { editPostedReplies } from '../resolve/editPostedReplies';
import { refreshWorktreeStatuses } from '../../runtime/worktreeStatuses/cache';
import { historyTargetOf } from './historyTargetOf';
import { recordHistoryEvent } from './recordHistoryEvent';
import { setHistoryRun } from './setHistoryRun';
import type { GetFn, HistoryRun, SetFn } from './types';

type RunParams = {
  readonly run: HistoryRun | undefined;
};

const isAwaitingHistoryPush = ({ run }: RunParams): boolean => {
  if (run === undefined) {
    return false;
  }
  if (run.phase === 'applied' || run.phase === 'pushing') {
    return true;
  }
  return (
    run.phase === 'stopped' &&
    (run.stop?.reason === 'push-failed' || run.stop?.reason === 'origin-moved')
  );
};

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly mountId: MountId;
};

type StepParams = {
  readonly title: string;
  readonly step: () => Promise<unknown>;
};

export const settleHistoryPush = async ({
  set,
  get,
  sessionId,
  mountId,
}: Params): Promise<void> => {
  const run = get().historyRuns[mountId];
  if (run === undefined || !isAwaitingHistoryPush({ run })) {
    return;
  }
  const { origin, planId } = run;
  const target = historyTargetOf({ get, sessionId, mountId });
  const attempt = async ({ title, step }: StepParams): Promise<void> => {
    try {
      await step();
    } catch (error) {
      await get().reportError({ title, error, severity: 'warning', sessionId });
    }
  };
  setHistoryRun({ set, sessionId, mountId, origin, patch: { phase: 'pushed', stop: null } });
  await attempt({
    title: "Couldn't refresh the branch status after the push.",
    step: () => refreshWorktreeStatuses({ worktreePaths: [target.worktreePath] }),
  });
  if (planId !== null) {
    await attempt({
      title: "Couldn't mark the plan as pushed.",
      step: () =>
        markHistoryPlan({ db: tauriDatabase, id: planId, state: 'pushed', at: Date.now() }),
    });
  }
  await attempt({
    title: "Couldn't update the replies that name the old commits.",
    step: () => editPostedReplies({ set, get, sessionId }),
  });
  const prNumber = get().mountGithub[mountId]?.pr?.number ?? null;
  const agentId = get().historyRuns[mountId]?.agentId ?? null;
  await recordHistoryEvent({
    get,
    kind: 'history_pushed',
    target,
    origin,
    planId,
    extra: {
      ...(prNumber !== null && { prNumber }),
      ...(agentId !== null && { agentId }),
    },
  });
  void get()
    .refreshPrDescription({ sessionId, mountId })
    .catch(() => false);
  void refreshWorktreeStatuses({ worktreePaths: [target.worktreePath] });
};
