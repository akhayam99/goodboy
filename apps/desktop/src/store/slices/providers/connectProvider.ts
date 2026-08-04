import {
  PROVIDER_CONNECT_CAPABILITIES,
  type ProviderConnectCapability,
  type ProviderId,
  type ProviderLifecycleAction,
} from '@goodboy/types';
import { PROVIDER_LABEL_LOWER, checkProviderAuth } from '../../../features/providers/providers';
import {
  invokeProviderLifecycleCancel,
  invokeProviderLifecycleRun,
  listenLifecycleExit,
  listenLifecycleOutput,
  resolveLifecycleCommand,
  type LifecycleExitPayload,
} from '../../../features/providers/provider-lifecycle';
import { openUrl } from '../../../shared/lib/editor';
import { formatError } from '../../../shared/lib/errors';
import { clearStallTimer, disposeConnectRun, getConnectRun, openConnectRun } from './connectRuns';
import type { ConnectRun } from './connectRuns';
import { detectAuthUrl } from './detectAuthUrl';
import { stripAnsi } from './stripAnsi';
import {
  ACTIVE_CONNECT_PHASES,
  IDLE_CONNECT,
  type GetFn,
  type ProviderConnectState,
  type SetFn,
} from './types';

const STALL_MS = 15_000;
const HANDOFF_LONG_MS = 30_000;
const HANDOFF_FALLBACK_MS = 120_000;
const PROBE_DELAYS_MS = [3_000, 6_000, 12_000, 24_000] as const;
const PROBE_CEILING_MS = 600_000;
const OUTPUT_TAIL_CAP = 4 * 1024;
const ERROR_TAIL_CAP = 500;
const PTY_COLS = 100;
const PTY_ROWS = 24;

type PatchParams = {
  readonly set: SetFn;
  readonly providerId: ProviderId;
  readonly patch: Partial<ProviderConnectState>;
};

const patchConnect = ({ set, providerId, patch }: PatchParams): void => {
  set((state) => ({
    providerConnect: {
      ...state.providerConnect,
      [providerId]: { ...state.providerConnect[providerId], ...patch },
    },
  }));
};

const lastMeaningfulLine = (tail: string): string | null => {
  const lines = stripAnsi({ text: tail })
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '');
  const last = lines[lines.length - 1];
  return last === undefined ? null : last.slice(-ERROR_TAIL_CAP);
};

type AttachParams = {
  readonly providerId: ProviderId;
  readonly action: ProviderLifecycleAction;
  readonly command: string;
  readonly env: Readonly<Record<string, string>>;
  readonly run: ConnectRun;
  readonly onOutput: (chunk: string) => void;
  readonly onExit: (payload: LifecycleExitPayload) => void;
};

const attachRun = async ({
  providerId,
  action,
  command,
  env,
  run,
  onOutput,
  onExit,
}: AttachParams): Promise<string> => {
  const runId = crypto.randomUUID();
  const unlistenOutput = await listenLifecycleOutput((payload) => {
    if (payload.runId !== runId) {
      return;
    }
    onOutput(atob(payload.data));
  });
  let stopExit: () => void = () => undefined;
  const unlistenExit = await listenLifecycleExit((payload) => {
    if (payload.runId !== runId) {
      return;
    }
    stopExit();
    unlistenOutput();
    onExit(payload);
  });
  stopExit = unlistenExit;
  run.unlisten.push(unlistenOutput, unlistenExit);
  await invokeProviderLifecycleRun({
    providerId,
    action,
    command,
    runId,
    cols: PTY_COLS,
    rows: PTY_ROWS,
    env,
  });
  return runId;
};

type StepParams = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly providerId: ProviderId;
  readonly run: ConnectRun;
};

const isOwnedRun = ({ providerId, run }: { providerId: ProviderId; run: ConnectRun }): boolean =>
  getConnectRun({ providerId }) === run;

const failRun = ({ set, get, providerId, run }: StepParams): void => {
  const errorTail = lastMeaningfulLine(run.outputTail);
  disposeConnectRun({ providerId });
  patchConnect({ set, providerId, patch: { phase: 'failed', errorTail } });
  void get().refreshProviders();
};

const runInstall = async ({ set, get, providerId, run }: StepParams): Promise<boolean> => {
  const command = resolveLifecycleCommand(providerId, 'install');
  patchConnect({ set, providerId, patch: { phase: 'working', step: 'install', command } });
  let settle: (ok: boolean) => void = () => undefined;
  const finished = new Promise<boolean>((resolve) => {
    settle = resolve;
  });
  try {
    const runId = await attachRun({
      providerId,
      action: 'install',
      command,
      env: {},
      run,
      onOutput: (chunk) => {
        run.outputTail = (run.outputTail + chunk).slice(-OUTPUT_TAIL_CAP);
      },
      onExit: (payload) => {
        if (!isOwnedRun({ providerId, run })) {
          settle(false);
          return;
        }
        if (payload.exitCode !== 0) {
          failRun({ set, get, providerId, run });
          settle(false);
          return;
        }
        settle(true);
      },
    });
    run.runId = runId;
    patchConnect({ set, providerId, patch: { runId } });
  } catch (err) {
    disposeConnectRun({ providerId });
    patchConnect({ set, providerId, patch: { phase: 'failed', errorTail: formatError(err) } });
    return false;
  }
  return finished;
};

type LoginParams = StepParams & {
  readonly capability: ProviderConnectCapability;
};

const finishSuccess = ({
  set,
  get,
  providerId,
  run,
  identity,
}: StepParams & { readonly identity: string | null }): void => {
  const { runId } = run;
  disposeConnectRun({ providerId });
  patchConnect({ set, providerId, patch: { phase: 'success', identity, errorTail: null } });
  if (runId !== null) {
    void invokeProviderLifecycleCancel(runId);
  }
  void get().emitNotification(
    'provider-connected',
    'success',
    `${PROVIDER_LABEL_LOWER[providerId]} is connected`,
    identity ?? undefined,
  );
  void get().refreshProviders();
};

type ProbeParams = StepParams & {
  readonly attempt: number;
  readonly startedAt: number;
};

const scheduleProbe = ({ set, get, providerId, run, attempt, startedAt }: ProbeParams): void => {
  const delay = PROBE_DELAYS_MS[Math.min(attempt, PROBE_DELAYS_MS.length - 1)] ?? PROBE_CEILING_MS;
  if (Date.now() - startedAt + delay > PROBE_CEILING_MS) {
    return;
  }
  run.probeTimer = window.setTimeout(() => {
    void probeOnce({ set, get, providerId, run, attempt, startedAt });
  }, delay);
};

const probeOnce = async ({
  set,
  get,
  providerId,
  run,
  attempt,
  startedAt,
}: ProbeParams): Promise<void> => {
  run.probeTimer = null;
  if (!isOwnedRun({ providerId, run })) {
    return;
  }
  const auth = await checkProviderAuth(providerId).catch(() => null);
  if (!isOwnedRun({ providerId, run })) {
    return;
  }
  if (auth?.state === 'connected') {
    finishSuccess({ set, get, providerId, run, identity: auth.identity });
    return;
  }
  if (!ACTIVE_CONNECT_PHASES.has(get().providerConnect[providerId].phase)) {
    return;
  }
  scheduleProbe({ set, get, providerId, run, attempt: attempt + 1, startedAt });
};

const enterHandoff = ({
  set,
  get,
  providerId,
  run,
  url,
}: StepParams & { readonly url: string }): void => {
  clearStallTimer(run);
  patchConnect({ set, providerId, patch: { phase: 'handoff', authUrl: url } });
  run.handoffTimers.push(
    window.setTimeout(() => {
      if (!isOwnedRun({ providerId, run })) {
        return;
      }
      if (get().providerConnect[providerId].phase !== 'handoff') {
        return;
      }
      patchConnect({ set, providerId, patch: { phase: 'waiting-long' } });
    }, HANDOFF_LONG_MS),
  );
  run.handoffTimers.push(
    window.setTimeout(() => {
      if (!isOwnedRun({ providerId, run })) {
        return;
      }
      const { phase } = get().providerConnect[providerId];
      if (phase !== 'handoff' && phase !== 'waiting-long') {
        return;
      }
      patchConnect({ set, providerId, patch: { phase: 'fallback-offered' } });
    }, HANDOFF_FALLBACK_MS),
  );
  scheduleProbe({ set, get, providerId, run, attempt: 0, startedAt: Date.now() });
};

const runLogin = async ({ set, get, providerId, run, capability }: LoginParams): Promise<void> => {
  const command = resolveLifecycleCommand(providerId, 'login');
  patchConnect({
    set,
    providerId,
    patch: { phase: 'working', step: 'login', command, authUrl: null, errorTail: null },
  });

  const armStall = () => {
    clearStallTimer(run);
    run.stallTimer = window.setTimeout(() => {
      run.stallTimer = null;
      if (!isOwnedRun({ providerId, run })) {
        return;
      }
      if (get().providerConnect[providerId].phase !== 'working') {
        return;
      }
      patchConnect({ set, providerId, patch: { phase: 'stall' } });
    }, STALL_MS);
  };

  const onOutput = (chunk: string) => {
    if (!isOwnedRun({ providerId, run })) {
      return;
    }
    run.outputTail = (run.outputTail + chunk).slice(-OUTPUT_TAIL_CAP);
    const { phase } = get().providerConnect[providerId];
    if (phase === 'stall') {
      patchConnect({ set, providerId, patch: { phase: 'working' } });
    }
    if (phase === 'working' || phase === 'stall') {
      armStall();
    }
    if (run.openedUrl) {
      return;
    }
    const url = detectAuthUrl({ text: stripAnsi({ text: chunk }) });
    if (url === null) {
      return;
    }
    run.openedUrl = true;
    void openUrl(url);
    enterHandoff({ set, get, providerId, run, url });
  };

  const onExit = (payload: LifecycleExitPayload) => {
    if (!isOwnedRun({ providerId, run })) {
      return;
    }
    if (payload.auth.state === 'connected') {
      finishSuccess({ set, get, providerId, run, identity: payload.auth.identity });
      return;
    }
    if (payload.exitCode !== 0 || payload.auth.state === 'disconnected') {
      failRun({ set, get, providerId, run });
      return;
    }
    disposeConnectRun({ providerId });
    patchConnect({ set, providerId, patch: { phase: 'finished-unverified' } });
    void get().refreshProviders();
  };

  try {
    const runId = await attachRun({
      providerId,
      action: 'login',
      command,
      env: capability.loginEnv,
      run,
      onOutput,
      onExit,
    });
    run.runId = runId;
    patchConnect({ set, providerId, patch: { runId } });
  } catch (err) {
    disposeConnectRun({ providerId });
    patchConnect({ set, providerId, patch: { phase: 'failed', errorTail: formatError(err) } });
    return;
  }
  armStall();
};

const isInstalled = ({ get, providerId }: { get: GetFn; providerId: ProviderId }): boolean => {
  const info = get().providers.find((provider) => provider.id === providerId);
  if (info === undefined) {
    return false;
  }
  return info.connection !== 'missing';
};

export const connectProvider = (set: SetFn, get: GetFn) => {
  return async (providerId: ProviderId): Promise<void> => {
    const capability = PROVIDER_CONNECT_CAPABILITIES[providerId];
    if (capability.tier === 'manual') {
      return;
    }
    if (ACTIVE_CONNECT_PHASES.has(get().providerConnect[providerId].phase)) {
      return;
    }
    const run = openConnectRun({ providerId });
    patchConnect({
      set,
      providerId,
      patch: { ...IDLE_CONNECT, phase: 'working', startedAt: Date.now() },
    });
    if (!isInstalled({ get, providerId })) {
      const installed = await runInstall({ set, get, providerId, run });
      if (!installed) {
        return;
      }
      if (!isOwnedRun({ providerId, run })) {
        return;
      }
    }
    await runLogin({ set, get, providerId, run, capability });
  };
};
