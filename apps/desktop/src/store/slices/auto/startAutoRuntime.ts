import type { UnlistenFn } from '@tauri-apps/api/event';
import { AUTO_GATES } from '@goodboy/core';
import { listAutoTreesToRecover, type Database } from '@goodboy/db';
import { brandId, type AutoDelegationId, type AutoTreeId, type WorkspaceId } from '@goodboy/types';
import { readAutoTreeLimit } from '../../../features/auto/autoTreeLimit';
import { registerDelegationDecisionPort } from '../../../features/auto/delegationDecisionPort';
import { registerTreeStopPort } from '../../../features/auto/treeStopPort';
import { invokeAgentList } from '../../../features/workflows/workflows';
import { lookupDeliveryRun, listLiveRunIds } from '../../../features/chat/turn';
import { worktreeSnapshot } from '../../../features/worktree/worktree';
import { isMainWindow } from '../../../features/workspace/window';
import { tauriDatabase } from '../../../shared/lib/db';
import { useAppStore } from '../../store';
import { revokeTreeCapabilities } from './capabilityCommands';
import { createAutoRuntime, type AutoRuntime } from './createAutoRuntime';
import { createRealAutoPorts } from './createRealAutoPorts';
import { AGENT_UNAVAILABLE } from './executeAgentCommand';
import { listenAgentCommands } from './listenAgentCommands';
import { createAutoScheduler } from './scheduler';
import type { SleepParams } from './startDeliveredTurn';
import { startAutoTrees } from './startAutoTrees';

export const AUTO_TICK_MS = 15_000;

const sleep = ({ ms }: SleepParams): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export type StartAutoRuntimeParams = Readonly<{
  db?: Database;
  isEnabled?: boolean;
  tickMs?: number;
}>;

export const startAutoRuntime = async ({
  db = tauriDatabase,
  isEnabled = AUTO_GATES.isDelegationEnabled,
  tickMs = AUTO_TICK_MS,
}: StartAutoRuntimeParams = {}): Promise<UnlistenFn> => {
  if (!isMainWindow()) {
    return () => undefined;
  }
  const getState = useAppStore.getState;
  const holder: { runtime: AutoRuntime | null } = { runtime: null };
  const runtimeOf = (): AutoRuntime => {
    if (holder.runtime !== null) {
      return holder.runtime;
    }
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
      watchYield: (params) => holder.runtime?.watchYield(params),
      sleep,
      nowMs: Date.now,
      newId: () => crypto.randomUUID(),
    });
    const scheduler = createAutoScheduler({ db, ownerId: crypto.randomUUID(), now: Date.now });
    holder.runtime = createAutoRuntime({
      ctx: { db, scheduler, ports, now: Date.now },
      isEnabled: true,
      onError: (error) => {
        void getState().reportError({ title: 'Auto hit a problem', error });
      },
    });
    return holder.runtime;
  };
  registerDelegationDecisionPort({
    port: ({ delegationId, decision }) =>
      runtimeOf().confirm({
        delegationId: brandId<AutoDelegationId>({ value: delegationId }),
        decision,
      }),
  });
  registerTreeStopPort({
    port: async ({ treeId }) => {
      const outcome = await runtimeOf().stop(brandId<AutoTreeId>({ value: treeId }));
      if (outcome.kind === 'stopping') {
        return 'stuck';
      }
      return outcome.kind === 'idle' && outcome.reason === 'not_owner' ? 'not_owner' : 'stopped';
    },
  });
  const unlisten = await listenAgentCommands({
    handle: async (command) =>
      isEnabled ? runtimeOf().executeCommand(command) : AGENT_UNAVAILABLE,
  });
  const unregister = (): void => {
    unlisten();
    registerDelegationDecisionPort({ port: null });
    registerTreeStopPort({ port: null });
    holder.runtime = null;
  };
  if (!isEnabled) {
    return unregister;
  }
  const runtime = runtimeOf();
  const recovered = new Set<string>();
  const tickTree = async (treeId: AutoTreeId): Promise<void> => {
    if (recovered.has(treeId)) {
      await runtime.drive(treeId);
      return;
    }
    if (await runtime.recover(treeId)) {
      recovered.add(treeId);
    }
  };
  const tick = async (): Promise<void> => {
    await startAutoTrees({
      ctx: runtime.ctx,
      sessionCapUsd: ({ sessionId }) => getState().sessionBudgets[sessionId]?.softCapUsd ?? null,
      workspaceLimitUsd: ({ workspaceId }) =>
        readAutoTreeLimit({ db, workspaceId: brandId<WorkspaceId>({ value: workspaceId }) }),
    });
    const trees = await listAutoTreesToRecover({ db });
    await Promise.all(trees.map((tree) => tickTree(tree.id)));
  };
  let isTicking = false;
  const run = (): void => {
    if (isTicking) {
      return;
    }
    isTicking = true;
    void tick()
      .catch((error: unknown) => {
        void getState().reportError({ title: 'Auto hit a problem', error });
      })
      .finally(() => {
        isTicking = false;
      });
  };
  run();
  const timer = setInterval(run, tickMs);
  return () => {
    clearInterval(timer);
    unregister();
  };
};
