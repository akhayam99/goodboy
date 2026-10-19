import type { Database } from '@goodboy/db';
import { isAutoPlanApprovalRequired } from '../../../features/auto/isAutoPlanApprovalRequired';
import { invokeAgentList } from '../../../features/workflows/workflows';
import { lookupDeliveryRun, listLiveRunIds } from '../../../features/chat/turn';
import { worktreeSnapshot } from '../../../features/worktree/worktree';
import { useAppStore, type AppStore } from '../../store';
import { createAutoRuntime, type AutoRuntime } from './createAutoRuntime';
import { createRealAutoPorts } from './createRealAutoPorts';
import { makeRefreshSessionArtifacts } from './makeRefreshSessionArtifacts';
import type { RefreshSessionArtifactsParams } from './ports';
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
  announceArtifacts?: (params: RefreshSessionArtifactsParams) => Promise<void>;
}>;

const announceNowhere = async (): Promise<void> => undefined;

export const makeAutoRuntime = ({
  db,
  getState,
  sleep = realSleep,
  watchPolls,
  announceArtifacts = announceNowhere,
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
    refreshSessionArtifacts: makeRefreshSessionArtifacts({
      get: getState,
      set: useAppStore.setState,
      announce: announceArtifacts,
    }),
    lookupDeliveryRun,
    worktreeSnapshot,
    listLiveRunIds,
    isPlanApprovalRequired: () => isAutoPlanApprovalRequired({ settings: getState().settings }),
    sleep,
    nowMs: Date.now,
    newId: () => crypto.randomUUID(),
  });
  const scheduler = createAutoScheduler({ db, ownerId: crypto.randomUUID(), now: Date.now });
  holder.runtime = createAutoRuntime({
    ctx: { db, scheduler, ports, now: Date.now },
    sleep,
    ...(watchPolls === undefined ? {} : { watchPolls }),
    onError: (error) => {
      void getState().reportError({ title: 'Auto hit a problem', error });
    },
  });
  return holder.runtime;
};
