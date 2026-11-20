import {
  PROVIDER_CONNECT_CAPABILITIES,
  PROVIDER_LIFECYCLE_COMMANDS,
} from '@goodboy/core/providers';
import type { AuthReason, ProviderDisplayInfo, ProviderStatus } from '../../providers/providers';
import { PROVIDER_LABEL } from '../../providers/providerLabel';
import type { AgentProviderId } from '../../../store/slices/providers/probeAgent';
import {
  ACTIVE_CONNECT_PHASES,
  type ProviderConnectState,
} from '../../../store/slices/providers/types';
import type { AgentCheck } from './useAgentDetection/agentChecks';

export type AgentRowState =
  | 'looking'
  | 'unchecked'
  | 'ready'
  | 'signin'
  | 'signing'
  | 'installing'
  | 'failed'
  | 'missing'
  | 'manual'
  | 'broken'
  | 'outdated';

export type AgentRowUpdate = {
  readonly command: string | null;
  readonly failure: string | null;
  readonly hasFailed: boolean;
};

export type AgentRow = {
  readonly id: AgentProviderId;
  readonly label: string;
  readonly product: string;
  readonly state: AgentRowState;
  readonly line: string;
  readonly installCommand: string | null;
  readonly runCommand: string | null;
  readonly output: string | null;
  readonly progress: string | null;
  readonly authUrl: string | null;
  readonly identity: string | null;
  readonly runId: string | null;
  readonly isFound: boolean;
  readonly binary: string;
  readonly docsUrl: string | null;
};

const PRODUCT_NAME: Readonly<Record<AgentProviderId, string>> = {
  anthropic: 'Claude Code',
  codex: 'Codex',
  cursor: 'Cursor Agent',
  gemini: 'Antigravity',
  copilot: 'Copilot',
};

const VERSION_NUMBER = /\d+(?:\.\d+)+/;

const UNFINISHED_PHASES: ReadonlySet<ProviderConnectState['phase']> = new Set([
  'failed',
  'blocked',
  'finished-unverified',
]);

type VersionParams = {
  readonly id: AgentProviderId;
  readonly version: string | null;
};

const productVersion = ({ id, version }: VersionParams): string => {
  const number = version === null ? null : (VERSION_NUMBER.exec(version)?.[0] ?? null);
  return number === null ? PRODUCT_NAME[id] : `${PRODUCT_NAME[id]} ${number}`;
};

type StateParams = {
  readonly id: AgentProviderId;
  readonly info: ProviderDisplayInfo | null;
  readonly status: ProviderStatus | null;
  readonly connect: ProviderConnectState;
  readonly check: AgentCheck;
  readonly authReason: AuthReason | null;
};

type MinimumParams = Pick<StateParams, 'authReason'>;

const minimumVersionOf = ({ authReason }: MinimumParams): string | null =>
  authReason?.kind === 'cli_too_old' ? authReason.minimum : null;

const isManual = ({ id }: Pick<StateParams, 'id'>): boolean =>
  PROVIDER_CONNECT_CAPABILITIES[id].tier === 'manual';

const stateOf = ({ id, info, status, connect, check, authReason }: StateParams): AgentRowState => {
  if (ACTIVE_CONNECT_PHASES.has(connect.phase)) {
    return connect.step === 'install' ? 'installing' : 'signing';
  }
  if (status?.available === true && minimumVersionOf({ authReason }) !== null) {
    return 'outdated';
  }
  if (info?.connection === 'connected') {
    return 'ready';
  }
  if (UNFINISHED_PHASES.has(connect.phase)) {
    return 'failed';
  }
  if (status === null) {
    return check.failure === null ? 'looking' : 'unchecked';
  }
  if (!status.available) {
    if (status.errorKind === 'timeout' || status.errorKind === 'exit') {
      return 'broken';
    }
    return isManual({ id }) ? 'manual' : 'missing';
  }
  if (info?.connection === 'error') {
    return 'broken';
  }
  return isManual({ id }) ? 'manual' : 'signin';
};

type LineParams = StateParams & {
  readonly state: AgentRowState;
};

const lineOf = ({ id, info, status, state, check, authReason }: LineParams): string => {
  if (check.failure !== null && state !== 'looking') {
    return `Couldn't check. ${check.failure}`;
  }
  const product = productVersion({ id, version: status?.version ?? null });
  switch (state) {
    case 'looking':
      return 'Looking on this Mac';
    case 'unchecked':
      return "Couldn't check this Mac";
    case 'ready':
      return info?.identity === null || info?.identity === undefined
        ? product
        : `${product} · ${info.identity}`;
    case 'signin':
    case 'signing':
    case 'failed':
      return `${product} found`;
    case 'installing':
      return `Installing ${PRODUCT_NAME[id]}`;
    case 'missing':
      return PRODUCT_NAME[id];
    case 'manual':
      return status?.available === true ? `${product} found, sign in there` : PRODUCT_NAME[id];
    case 'broken':
      return status?.version === null || status?.version === undefined
        ? `${PRODUCT_NAME[id]} stopped on start`
        : `${product} found, it stopped on start`;
    case 'outdated': {
      const needs = `Goodboy needs ${minimumVersionOf({ authReason }) ?? 'a newer one'} or later`;
      return info?.identity === null || info?.identity === undefined
        ? `${product} found. ${needs}`
        : `${product} · ${info.identity}. ${needs}`;
    }
    default: {
      const unreachable: never = state;
      return unreachable;
    }
  }
};

type OutputParams = Pick<StateParams, 'status' | 'connect'> & {
  readonly state: AgentRowState;
};

const outputOf = ({ state, status, connect }: OutputParams): string | null => {
  if (state === 'failed') {
    return connect.errorTail;
  }
  if (state === 'broken') {
    return status?.error ?? null;
  }
  return null;
};

const PROGRESS: Partial<Readonly<Record<ProviderConnectState['phase'], string>>> = {
  working: 'Opening your browser to sign in.',
  handoff: 'Finish signing in from your browser.',
  'waiting-long': 'Still waiting for the browser. This can take a minute.',
  'fallback-offered': 'Still waiting for the browser. This can take a minute.',
  stall: 'No answer yet. The terminal shows what the CLI asks.',
};

type ProgressParams = Pick<StateParams, 'connect'> & {
  readonly state: AgentRowState;
};

const progressOf = ({ state, connect }: ProgressParams): string | null => {
  if (state === 'installing') {
    return 'Installing. This can take a minute.';
  }
  if (state === 'signing') {
    return PROGRESS[connect.phase] ?? null;
  }
  return null;
};

export const agentRowOf = ({
  id,
  info,
  status,
  connect,
  check,
  authReason,
}: StateParams): AgentRow => {
  const state = stateOf({ id, info, status, connect, check, authReason });
  const commands = PROVIDER_LIFECYCLE_COMMANDS[id];
  return {
    id,
    label: PROVIDER_LABEL[id],
    product: PRODUCT_NAME[id],
    state,
    line: lineOf({ id, info, status, connect, check, authReason, state }),
    installCommand: commands?.install?.darwin ?? null,
    runCommand: connect.command,
    output: outputOf({ state, status, connect }),
    progress: progressOf({ state, connect }),
    authUrl: connect.authUrl,
    identity: connect.identity ?? info?.identity ?? null,
    runId: connect.runId,
    isFound: status?.available === true,
    binary: info?.binary ?? status?.binary ?? PRODUCT_NAME[id],
    docsUrl: info?.docsUrl ?? null,
  };
};
