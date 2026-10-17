import { AUTO_GATES } from '@goodboy/core';
import { listAutoTreesToRecover, type Database } from '@goodboy/db';
import { brandId, type AutoDelegationId, type AutoTreeId, type WorkspaceId } from '@goodboy/types';
import { SETTING_AUTO_PLAN_APPROVAL } from '../../../features/settings/settings';
import { registerAutoDrivePort } from '../../../features/auto/autoDrivePort';
import {
  currentAutoUserTurnPort,
  registerAutoUserTurnPort,
} from '../../../features/auto/autoUserTurnPort';
import { readAutoTreeLimit } from '../../../features/auto/autoTreeLimit';
import {
  currentDelegationDecisionPort,
  registerDelegationDecisionPort,
} from '../../../features/auto/delegationDecisionPort';
import { currentTreeRetryPort, registerTreeRetryPort } from '../../../features/auto/treeRetryPort';
import { currentTreeStopPort, registerTreeStopPort } from '../../../features/auto/treeStopPort';
import type {
  AutoBridgeBus,
  AutoBridgePorts,
} from '../../../features/auto/bridge/autoBridgeProtocol';
import { createAutoBridgeClient } from '../../../features/auto/bridge/createAutoBridgeClient';
import { serveAutoBridge } from '../../../features/auto/bridge/serveAutoBridge';
import { tauriAutoBridgeBus } from '../../../features/auto/bridge/tauriAutoBridgeBus';
import { isMainWindow } from '../../../features/workspace/window';
import { tauriDatabase } from '../../../shared/lib/db';
import { useAppStore } from '../../store';
import type { AutoRuntime } from './createAutoRuntime';
import { makeAutoRuntime } from './makeAutoRuntime';
import type { SleepParams } from './startDeliveredTurn';
import {
  startAutoTree,
  startAutoTrees,
  type SessionCapParams,
  type WorkspaceLimitParams,
} from './startAutoTrees';

const AUTO_TICK_MS = 15_000;

const NO_RUNTIME = 'Auto is not running in the main window.';

type PortParams<Port> = {
  readonly port: Port | null;
};

const requirePort = <Port>({ port }: PortParams<Port>): Port => {
  if (port === null) {
    throw new Error(NO_RUNTIME);
  }
  return port;
};

const REGISTERED_PORTS: AutoBridgePorts = {
  stop: (params) => requirePort({ port: currentTreeStopPort() })(params),
  retry: (params) => requirePort({ port: currentTreeRetryPort() })(params),
  userTurn: (params) => requirePort({ port: currentAutoUserTurnPort() })(params),
  decision: (params) => requirePort({ port: currentDelegationDecisionPort() })(params),
};

type ForwardParams = {
  readonly bus: AutoBridgeBus;
};

const forwardToMain = async ({ bus }: ForwardParams): Promise<() => void> => {
  const client = await createAutoBridgeClient({ bus, newId: () => crypto.randomUUID() });
  registerTreeStopPort({ port: client.ports.stop });
  registerTreeRetryPort({ port: client.ports.retry });
  registerDelegationDecisionPort({ port: client.ports.decision });
  registerAutoUserTurnPort({ port: client.ports.userTurn });
  return () => {
    client.close();
    registerTreeStopPort({ port: null });
    registerTreeRetryPort({ port: null });
    registerDelegationDecisionPort({ port: null });
    registerAutoUserTurnPort({ port: null });
  };
};

const sleep = ({ ms }: SleepParams): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export type StartAutoRuntimeParams = Readonly<{
  db?: Database;
  isEnabled?: boolean;
  tickMs?: number;
  bus?: AutoBridgeBus;
  isMain?: boolean;
}>;

export const startAutoRuntime = async ({
  db = tauriDatabase,
  isEnabled = AUTO_GATES.isDelegationEnabled,
  tickMs = AUTO_TICK_MS,
  bus = tauriAutoBridgeBus,
  isMain = isMainWindow(),
}: StartAutoRuntimeParams = {}): Promise<() => void> => {
  if (!isMain) {
    return forwardToMain({ bus });
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
  registerTreeRetryPort({
    port: async ({ treeId }) => {
      const outcome = await runtimeOf().retry(brandId<AutoTreeId>({ value: treeId }));
      if (outcome.kind === 'refused') {
        return { kind: 'refused', message: outcome.message };
      }
      if (outcome.kind === 'idle' && outcome.reason === 'not_owner') {
        return { kind: 'refused', message: 'Another window runs this conversation. Retry there.' };
      }
      return { kind: 'retried' };
    },
  });
  const unserve = await serveAutoBridge({
    bus,
    ports: REGISTERED_PORTS,
    onError: (error) => {
      void getState().reportError({ title: 'Auto could not answer another window', error });
    },
  });
  const unregister = (): void => {
    unserve();
    registerTreeRetryPort({ port: null });
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
    port: async ({ agentId, sessionId, workspaceId, text, images }) => {
      const started = await startAutoTree({
        ctx: runtime.ctx,
        agent: { agentId, sessionId, workspaceId },
        ...treeCaps,
      });
      const outcome = await runtime.say({
        treeId: started.tree.id,
        text,
        ...(images !== undefined && { images }),
      });
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
