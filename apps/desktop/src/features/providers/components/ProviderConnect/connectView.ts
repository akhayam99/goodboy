import type { ProviderConnectPhase, ProviderConnectStep } from '../../../../store/slices/providers';

export type ProviderConnectChrome = 'studio' | 'modal' | 'inline';

type ConnectPrimary = 'connect' | 'cancel' | 'retry' | 'done';

export type ConnectView = {
  readonly status: string | null;
  readonly note: string | null;
  readonly primary: ConnectPrimary | null;
  readonly primaryLabel: string | null;
  readonly isRunning: boolean;
  readonly isSuccess: boolean;
  readonly isFailure: boolean;
  readonly showAuthLink: boolean;
  readonly showTerminalHint: boolean;
  readonly hasDetails: boolean;
  readonly autoDetails: boolean;
};

type Params = {
  readonly phase: ProviderConnectPhase;
  readonly step: ProviderConnectStep | null;
  readonly providerLabel: string;
  readonly identity: string | null;
  readonly chrome: ProviderConnectChrome;
};

const PRIMARY_LABEL: Readonly<Record<ConnectPrimary, string>> = {
  connect: 'Connect',
  cancel: 'Cancel',
  retry: 'Try again',
  done: 'Done',
};

const HANDOFF_STATUS = 'Finish signing in in your browser.';
const WAITING_NOTE = 'Still waiting for the browser. This can take a minute.';

const REST: ConnectView = {
  status: null,
  note: null,
  primary: 'connect',
  primaryLabel: PRIMARY_LABEL.connect,
  isRunning: false,
  isSuccess: false,
  isFailure: false,
  showAuthLink: false,
  showTerminalHint: false,
  hasDetails: false,
  autoDetails: false,
};

const RUNNING: ConnectView = {
  ...REST,
  primary: 'cancel',
  primaryLabel: PRIMARY_LABEL.cancel,
  isRunning: true,
  hasDetails: true,
};

export const connectView = ({
  phase,
  step,
  providerLabel,
  identity,
  chrome,
}: Params): ConnectView => {
  switch (phase) {
    case 'idle':
    case 'cancelled':
      return REST;
    case 'working':
      return {
        ...RUNNING,
        status: step === 'install' ? `Installing the ${providerLabel} tool…` : 'Starting sign-in…',
      };
    case 'handoff':
      return { ...RUNNING, status: HANDOFF_STATUS, showAuthLink: true };
    case 'waiting-long':
      return { ...RUNNING, status: HANDOFF_STATUS, note: WAITING_NOTE, showAuthLink: true };
    case 'fallback-offered':
      return {
        ...RUNNING,
        status: HANDOFF_STATUS,
        note: WAITING_NOTE,
        showAuthLink: true,
        showTerminalHint: true,
      };
    case 'stall':
      return { ...RUNNING, status: 'This sign-in needs a choice from you.', autoDetails: true };
    case 'success':
      return {
        ...REST,
        status: identity === null ? 'Connected' : `Connected as ${identity}`,
        primary: chrome === 'studio' ? null : 'done',
        primaryLabel: chrome === 'studio' ? null : PRIMARY_LABEL.done,
        isSuccess: true,
      };
    case 'finished-unverified':
      return {
        ...REST,
        status: 'Sign-in finished. Run a small task to confirm it worked.',
        primary: 'done',
        primaryLabel: PRIMARY_LABEL.done,
        hasDetails: true,
      };
    case 'failed':
      return {
        ...REST,
        status: "Sign-in didn't finish.",
        primary: 'retry',
        primaryLabel: PRIMARY_LABEL.retry,
        isFailure: true,
        showTerminalHint: true,
        hasDetails: true,
        autoDetails: true,
      };
    default: {
      const exhaustive: never = phase;
      return exhaustive;
    }
  }
};

export const isConnectRunning = ({ phase }: { readonly phase: ProviderConnectPhase }): boolean =>
  connectView({ phase, step: null, providerLabel: '', identity: null, chrome: 'inline' }).isRunning;
