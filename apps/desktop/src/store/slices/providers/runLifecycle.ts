import {
  cleanCliVersion,
  providerFlags,
  providersOnSameBinary,
  type ProviderStatusSlot,
} from '@goodboy/core';
import type { ProviderId, ProviderLifecycleAction } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { cliUpdateResultOf } from '../../../features/providers/cliUpdateResult';
import {
  type ProviderAuthResults,
  type ProviderStatus,
  type ProviderStatuses,
} from '../../../features/providers/providers';
import {
  invokeProviderLifecycleRun,
  listenLifecycleExit,
  listenLifecycleOutput,
  resolveLifecycleCommand,
  type LifecycleExitPayload,
} from '../../../features/providers/provider-lifecycle';
import { applyProviderProbe, takeProbeSeq } from './applyProviderProbe';
import { detectAuthUrl } from './detectAuthUrl';
import { base64Bytes } from '../../../shared/utils/base64Bytes';
import { stripAnsi } from '../../../shared/utils/stripAnsi';
import type { GetFn, SetFn } from './types';
import { ACTIVE_LIFECYCLE_PHASES, IDLE_LIFECYCLE, type ProviderLifecyclePhase } from './types';

const OUTPUT_TAIL_CAP = 4 * 1024;
const ERROR_TAIL_CAP = 500;

function pendingPhase(action: ProviderLifecycleAction): ProviderLifecyclePhase {
  switch (action) {
    case 'install':
      return 'installing';
    case 'login':
      return 'connecting';
    case 'logout':
      return 'disconnecting';
    case 'update':
      return 'updating';
    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}

function restingPhase(
  action: ProviderLifecycleAction,
  payload: LifecycleExitPayload,
): ProviderLifecyclePhase {
  const installed = payload.status.available;
  const connected = payload.auth.state === 'connected';
  if (action === 'update') {
    return payload.exitCode === 0 && installed ? 'installed' : 'error';
  }
  if (payload.exitCode !== 0) {
    if (action === 'install') {
      return installed ? 'installed' : 'error';
    }
    if (action === 'login') {
      return connected ? 'connected' : 'error';
    }
    return connected ? 'error' : 'installed';
  }
  if (action === 'install') {
    return installed ? 'installed' : 'error';
  }
  if (action === 'login') {
    return connected ? 'connected' : 'error';
  }
  return connected ? 'error' : 'installed';
}

type SlotPatchParams = {
  readonly providerId: ProviderId;
  readonly status: ProviderStatus;
};

const statusSlotPatch = ({
  providerId,
  status,
}: SlotPatchParams): Partial<Record<ProviderStatusSlot, ProviderStatus>> => {
  const { statusSlot } = providerFlags({ id: providerId });
  return statusSlot === null ? {} : { [statusSlot]: status };
};

type StatusesParams = {
  readonly providerId: ProviderId;
  readonly status: ProviderStatus;
  readonly state: ReturnType<GetFn>;
};

const statusesAfterExit = ({ providerId, status, state }: StatusesParams): ProviderStatuses => {
  const sameBinary = providersOnSameBinary({ id: providerId });
  const statusOf = (id: ProviderId): ProviderStatus | null => {
    if (id === providerId) {
      return status;
    }
    if (sameBinary.includes(id)) {
      return { ...status, id };
    }
    const { statusSlot } = providerFlags({ id });
    return statusSlot === null
      ? storedStatus({ providerId: id, providers: state.providers })
      : state[statusSlot];
  };
  return {
    anthropic: statusOf('anthropic'),
    cursor: statusOf('cursor'),
    codex: statusOf('codex'),
    gemini: statusOf('gemini'),
    opencode: statusOf('opencode'),
    openrouter: statusOf('openrouter'),
    moonshot: statusOf('moonshot'),
  };
};

type StoredStatusParams = {
  readonly providerId: ProviderId;
  readonly providers: ReturnType<GetFn>['providers'];
};

const storedStatus = ({ providerId, providers }: StoredStatusParams): ProviderStatus | null => {
  const info = providers.find((provider) => provider.id === providerId);
  if (info === undefined) {
    return null;
  }
  return {
    id: providerId,
    binary: info.binary,
    available:
      info.connection !== 'missing' && info.connection !== 'error' && info.connection !== 'unknown',
    version: info.version,
    error: info.error,
  };
};

export type RunLifecycleArgs = {
  readonly providerId: ProviderId;
  readonly action: ProviderLifecycleAction;
  readonly cols?: number;
  readonly rows?: number;
  readonly onExit?: (payload: LifecycleExitPayload) => void;
};

export const runLifecycle = async (
  set: SetFn,
  get: GetFn,
  { providerId, action, cols = 100, rows = 24, onExit }: RunLifecycleArgs,
): Promise<void> => {
  const existing = get().providerLifecycle[providerId];
  if (ACTIVE_LIFECYCLE_PHASES.has(existing.phase)) {
    return;
  }

  const runId = crypto.randomUUID();
  const command = resolveLifecycleCommand(providerId, action);
  const startedAt = Date.now();

  set((state) => ({
    providerLifecycle: {
      ...state.providerLifecycle,
      [providerId]: {
        phase: pendingPhase(action),
        runId,
        action,
        command,
        exitCode: null,
        startedAt,
        errorTail: null,
        detectedAuthUrl: null,
        update: null,
      },
    },
  }));
  const versionBefore = cleanCliVersion({
    raw: get().providers.find((provider) => provider.id === providerId)?.version ?? null,
  });

  const decoder = new TextDecoder('utf-8');
  let outputTail = '';
  let authScore = 0;
  let unlistenOutput: () => void = () => undefined;
  let unlistenExit: () => void = () => undefined;

  try {
    unlistenOutput = await listenLifecycleOutput((payload) => {
      if (payload.runId !== runId) {
        return;
      }
      const chunk = decoder.decode(base64Bytes({ data: payload.data }), { stream: true });
      outputTail = (outputTail + chunk).slice(-OUTPUT_TAIL_CAP);
      const match = detectAuthUrl({ text: stripAnsi({ text: outputTail }) });
      if (match === null || match.score <= authScore) {
        return;
      }
      authScore = match.score;
      set((state) => {
        const curr = state.providerLifecycle[providerId];
        if (curr.runId !== runId) {
          return {};
        }
        return {
          providerLifecycle: {
            ...state.providerLifecycle,
            [providerId]: { ...curr, detectedAuthUrl: match.url },
          },
        };
      });
    });

    unlistenExit = await listenLifecycleExit((payload) => {
      if (payload.runId !== runId) {
        return;
      }
      unlistenExit();
      unlistenOutput();

      const curr = get().providerLifecycle[providerId];
      const finalPhase: ProviderLifecyclePhase =
        curr.phase === 'cancelled' ? 'cancelled' : restingPhase(action, payload);
      const errorTail =
        finalPhase === 'error' ? stripAnsi({ text: outputTail }).slice(-ERROR_TAIL_CAP) : null;
      const update =
        action === 'update' && finalPhase === 'installed'
          ? cliUpdateResultOf({ before: versionBefore, status: payload.status })
          : null;

      const state = get();
      const statuses = statusesAfterExit({ providerId, status: payload.status, state });
      const authResults: ProviderAuthResults = {
        ...(state.authResults ?? {}),
        [providerId]: payload.auth,
      };
      const exitPatch = {
        ...statusSlotPatch({ providerId, status: payload.status }),
        providerLifecycle: {
          ...state.providerLifecycle,
          [providerId]: {
            ...curr,
            phase: finalPhase,
            exitCode: payload.exitCode,
            errorTail,
            update,
          },
        },
      };
      applyProviderProbe({
        set,
        get,
        seq: takeProbeSeq(),
        statuses,
        authResults,
        only: providersOnSameBinary({ id: providerId }),
        isImmediate: true,
        patch: exitPatch,
      });
      onExit?.(payload);
      void get().refreshProviders({ isFresh: true });
    });

    await invokeProviderLifecycleRun({
      providerId,
      action,
      runId,
      cols,
      rows,
    });
  } catch (err) {
    unlistenExit();
    unlistenOutput();
    set((state) => ({
      providerLifecycle: {
        ...state.providerLifecycle,
        [providerId]: {
          ...IDLE_LIFECYCLE,
          phase: 'error',
          action,
          command,
          errorTail: formatError(err),
        },
      },
    }));
  }
};
