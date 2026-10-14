import type { UnlistenFn } from '@tauri-apps/api/event';
import { AUTO_GATES } from '@goodboy/core';
import { listAutoTreesToRecover, type Database } from '@goodboy/db';
import { brandId, type AutoDelegationId, type AutoTreeId, type WorkspaceId } from '@goodboy/types';
import { SETTING_AUTO_PLAN_APPROVAL } from '../../../features/settings/settings';
import { registerAutoDrivePort } from '../../../features/auto/autoDrivePort';
import { registerAutoUserTurnPort } from '../../../features/auto/autoUserTurnPort';
import { readAutoTreeLimit } from '../../../features/auto/autoTreeLimit';
import { registerDelegationDecisionPort } from '../../../features/auto/delegationDecisionPort';
import { registerTreeStopPort } from '../../../features/auto/treeStopPort';
import { isMainWindow } from '../../../features/workspace/window';
import { tauriDatabase } from '../../../shared/lib/db';
import { useAppStore } from '../../store';
import type { AutoRuntime } from './createAutoRuntime';
import { AGENT_UNAVAILABLE } from './executeAgentCommand';
import { listenAgentCommands } from './listenAgentCommands';
import { makeAutoRuntime } from './makeAutoRuntime';
import type { SleepParams } from './startDeliveredTurn';
import {
  startAutoTree,
  startAutoTrees,
  type SessionCapParams,
  type WorkspaceLimitParams,
} from './startAutoTrees';

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
    holder.runtime ??= makeAutoRuntime({ db, getState, sleep });
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
    registerAutoUserTurnPort({ port: null });
    registerAutoDrivePort({ port: null });
    registerDelegationDecisionPort({ port: null });
    registerTreeStopPort({ port: null });
    holder.runtime = null;
  };
  if (!isEnabled) {
    return unregister;
  }
  const runtime = runtimeOf();
  const treeCaps = {
    sessionCapUsd: ({ sessionId }: SessionCapParams) =>
      getState().sessionBudgets[sessionId]?.softCapUsd ?? null,
    workspaceLimitUsd: ({ workspaceId }: WorkspaceLimitParams) =>
      readAutoTreeLimit({ db, workspaceId: brandId<WorkspaceId>({ value: workspaceId }) }),
  };
  registerAutoDrivePort({ port: ({ treeId }) => runtime.drive(treeId) });
  registerAutoUserTurnPort({
    port: async ({ agentId, sessionId, workspaceId, text }) => {
      const started = await startAutoTree({
        ctx: runtime.ctx,
        agent: { agentId, sessionId, workspaceId },
        ...treeCaps,
      });
      const outcome = await runtime.say({ treeId: started.tree.id, text });
      return outcome.kind === 'queued' ? 'queued' : 'lost';
    },
  });
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
    await getState().loadSetting(SETTING_AUTO_PLAN_APPROVAL);
    await startAutoTrees({ ctx: runtime.ctx, ...treeCaps });
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
