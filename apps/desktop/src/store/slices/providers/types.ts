import type { ProviderId, ProviderLifecycleAction } from '@goodboy/types';

export type { SetFn, GetFn } from '../../slice-types';

export type ProviderLifecyclePhase =
  | 'idle'
  | 'installing'
  | 'installed'
  | 'connecting'
  | 'connected'
  | 'disconnecting'
  | 'error'
  | 'cancelled';

export type ProviderLifecycleState = {
  readonly phase: ProviderLifecyclePhase;
  readonly runId: string | null;
  readonly action: ProviderLifecycleAction | null;
  readonly command: string | null;
  readonly exitCode: number | null;
  readonly startedAt: number | null;
  readonly errorTail: string | null;
  readonly detectedAuthUrl: string | null;
};

export const IDLE_LIFECYCLE: ProviderLifecycleState = {
  phase: 'idle',
  runId: null,
  action: null,
  command: null,
  exitCode: null,
  startedAt: null,
  errorTail: null,
  detectedAuthUrl: null,
};

export type ProviderConnectPhase =
  | 'idle'
  | 'working'
  | 'handoff'
  | 'waiting-long'
  | 'fallback-offered'
  | 'stall'
  | 'success'
  | 'finished-unverified'
  | 'failed'
  | 'cancelled';

export type ProviderConnectStep = 'install' | 'login';

export type ProviderConnectState = {
  readonly phase: ProviderConnectPhase;
  readonly step: ProviderConnectStep | null;
  readonly runId: string | null;
  readonly command: string | null;
  readonly authUrl: string | null;
  readonly identity: string | null;
  readonly errorTail: string | null;
  readonly startedAt: number | null;
};

export const IDLE_CONNECT: ProviderConnectState = {
  phase: 'idle',
  step: null,
  runId: null,
  command: null,
  authUrl: null,
  identity: null,
  errorTail: null,
  startedAt: null,
};

export type ProviderConnectMap = Readonly<Record<ProviderId, ProviderConnectState>>;

export const INITIAL_CONNECT_MAP: ProviderConnectMap = {
  anthropic: IDLE_CONNECT,
  cursor: IDLE_CONNECT,
  codex: IDLE_CONNECT,
  gemini: IDLE_CONNECT,
  opencode: IDLE_CONNECT,
  openrouter: IDLE_CONNECT,
};

export const ACTIVE_CONNECT_PHASES: ReadonlySet<ProviderConnectPhase> =
  new Set<ProviderConnectPhase>([
    'working',
    'handoff',
    'waiting-long',
    'fallback-offered',
    'stall',
  ]);

export const PROBED_CONNECT_PHASES: ReadonlySet<ProviderConnectPhase> =
  new Set<ProviderConnectPhase>([...ACTIVE_CONNECT_PHASES, 'finished-unverified']);

export type ProviderLifecycleMap = Readonly<Record<ProviderId, ProviderLifecycleState>>;

export const INITIAL_LIFECYCLE_MAP: ProviderLifecycleMap = {
  anthropic: IDLE_LIFECYCLE,
  cursor: IDLE_LIFECYCLE,
  codex: IDLE_LIFECYCLE,
  gemini: IDLE_LIFECYCLE,
  opencode: IDLE_LIFECYCLE,
  openrouter: IDLE_LIFECYCLE,
};
