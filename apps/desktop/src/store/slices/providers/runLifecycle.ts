import type { ProviderId, ProviderLifecycleAction } from '@goodboy/types';
import {
  buildProviderList,
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
import { formatError } from '../../../shared/lib/errors';
import { detectAuthUrl } from './detectAuthUrl';
import { stripAnsi } from './stripAnsi';
import type { GetFn, SetFn } from './types';
import { IDLE_LIFECYCLE, type ProviderLifecyclePhase } from './types';

const OUTPUT_TAIL_CAP = 4 * 1024;
const ERROR_TAIL_CAP = 500;

function pendingPhase(action: ProviderLifecycleAction): ProviderLifecyclePhase {
  if (action === 'install') {
    return 'installing';
  }
  if (action === 'login') {
    return 'connecting';
  }
  return 'disconnecting';
}

function restingPhase(
  action: ProviderLifecycleAction,
  payload: LifecycleExitPayload,
): ProviderLifecyclePhase {
  const installed = payload.status.available;
  const connected = payload.auth.state === 'connected';
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

function statusSlotPatch(
  providerId: ProviderId,
  status: ProviderStatus,
): {
  providerStatus?: ProviderStatus;
  cursorStatus?: ProviderStatus;
  codexStatus?: ProviderStatus;
  geminiStatus?: ProviderStatus;
} {
  if (providerId === 'anthropic') {
    return { providerStatus: status };
  }
  if (providerId === 'cursor') {
    return { cursorStatus: status };
  }
  if (providerId === 'codex') {
    return { codexStatus: status };
  }
  if (providerId === 'gemini') {
    return { geminiStatus: status };
  }
  return {};
}

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
    available: info.connection !== 'missing' && info.connection !== 'error',
    version: info.version,
    error: info.error,
  };
};

export type RunLifecycleArgs = {
  readonly providerId: ProviderId;
  readonly action: ProviderLifecycleAction;
  readonly cols?: number;
  readonly rows?: number;
};

export const runLifecycle = async (
  set: SetFn,
  get: GetFn,
  { providerId, action, cols = 100, rows = 24 }: RunLifecycleArgs,
): Promise<void> => {
  const existing = get().providerLifecycle[providerId];
  if (
    existing.phase === 'installing' ||
    existing.phase === 'connecting' ||
    existing.phase === 'disconnecting'
  ) {
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
      },
    },
  }));

  let outputTail = '';
  let foundAuthUrl = false;
  let unlistenOutput: () => void = () => undefined;
  let unlistenExit: () => void = () => undefined;

  unlistenOutput = await listenLifecycleOutput((payload) => {
    if (payload.runId !== runId) {
      return;
    }
    const chunk = atob(payload.data);
    outputTail = (outputTail + chunk).slice(-OUTPUT_TAIL_CAP);
    if (!foundAuthUrl) {
      const url = detectAuthUrl({ text: stripAnsi({ text: outputTail }) });
      if (url !== null) {
        foundAuthUrl = true;
        set((state) => {
          const curr = state.providerLifecycle[providerId];
          if (curr.runId !== runId) {
            return {};
          }
          return {
            providerLifecycle: {
              ...state.providerLifecycle,
              [providerId]: { ...curr, detectedAuthUrl: url },
            },
          };
        });
      }
    }
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

    set((state) => {
      const statuses: ProviderStatuses = {
        anthropic: providerId === 'anthropic' ? payload.status : state.providerStatus,
        cursor: providerId === 'cursor' ? payload.status : state.cursorStatus,
        codex: providerId === 'codex' ? payload.status : state.codexStatus,
        gemini: providerId === 'gemini' ? payload.status : state.geminiStatus,
        opencode:
          providerId === 'opencode'
            ? payload.status
            : storedStatus({ providerId: 'opencode', providers: state.providers }),
        openrouter:
          providerId === 'opencode'
            ? { ...payload.status, id: 'openrouter' }
            : storedStatus({ providerId: 'openrouter', providers: state.providers }),
      };
      const authResults: ProviderAuthResults = {
        ...(state.authResults ?? {}),
        [providerId]: payload.auth,
      };
      const credentialProviderIds = new Set(
        state.providerCredentials.map((item) => item.providerId),
      );
      return {
        ...statusSlotPatch(providerId, payload.status),
        authResults,
        providers: buildProviderList(statuses, authResults, credentialProviderIds),
        providerLifecycle: {
          ...state.providerLifecycle,
          [providerId]: {
            ...curr,
            phase: finalPhase,
            exitCode: payload.exitCode,
            errorTail,
          },
        },
      };
    });
    void get().refreshProviders();
  });

  try {
    await invokeProviderLifecycleRun({
      providerId,
      action,
      command,
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
