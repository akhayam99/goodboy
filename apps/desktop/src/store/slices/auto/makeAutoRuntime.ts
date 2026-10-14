import type { Database } from '@goodboy/db';
import { isAutoPlanApprovalRequired } from '../../../features/auto/isAutoPlanApprovalRequired';
import { invokeAgentList } from '../../../features/workflows/workflows';
import { lookupDeliveryRun, listLiveRunIds } from '../../../features/chat/turn';
import { worktreeSnapshot } from '../../../features/worktree/worktree';
import { useAppStore, type AppStore } from '../../store';
import { revokeTreeCapabilities } from './capabilityCommands';
import { createAutoRuntime, type AutoRuntime } from './createAutoRuntime';
import { createRealAutoPorts } from './createRealAutoPorts';
import { createAutoScheduler } from './scheduler';
import type { SleepParams } from './startDeliveredTurn';

const realSleep = ({ ms }: SleepParams): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export type MakeAutoRuntimeParams = Readonly<{
  db: Database;
  getState: () => AppStore;
  sleep?: (params: SleepParams) => Promise<void>;
  watchPolls?: number;
}>;

export const makeAutoRuntime = ({
  db,
  getState,
  sleep = realSleep,
  watchPolls,
}: MakeAutoRuntimeParams): AutoRuntime => {
  const holder: { runtime: AutoRuntime | null } = { runtime: null };
  const ports = createRealAutoPorts({
    db,
    getState,
    sendTurn: (input) => getState().sendTurn(input),
    cancelTurnConfirmed: (params) => getState().cancelTurnConfirmed(params),
    loadSessionMounts: (params) => getState().loadSessionMounts(params),
    refreshAgents: async ({ sessionId }) => {
      const agents = await invokeAgentList(sessionId);
      useAppStore.setState((state) => ({
        sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: agents },
      }));
    },
    lookupDeliveryRun,
    worktreeSnapshot,
    revokeTreeCapabilities,
    listLiveRunIds,
    isPlanApprovalRequired: () => isAutoPlanApprovalRequired({ settings: getState().settings }),
    watchYield: (params) => holder.runtime?.watchYield(params),
    sleep,
    nowMs: Date.now,
    newId: () => crypto.randomUUID(),
  });
  const scheduler = createAutoScheduler({ db, ownerId: crypto.randomUUID(), now: Date.now });
  holder.runtime = createAutoRuntime({
    ctx: { db, scheduler, ports, now: Date.now },
    isEnabled: true,
    sleep,
    ...(watchPolls === undefined ? {} : { watchPolls }),
    onError: (error) => {
      void getState().reportError({ title: 'Auto hit a problem', error });
    },
  });
  return holder.runtime;
};
