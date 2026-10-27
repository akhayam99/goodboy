import { PROVIDER_IDS, type ProviderId } from '@goodboy/types';

export type ProviderStatusSlot = 'providerStatus' | 'cursorStatus' | 'codexStatus' | 'geminiStatus';

export type ProviderFlags = {
  readonly binary: string;
  readonly statusSlot: ProviderStatusSlot | null;
  readonly shouldReplayHistoryAsText: boolean;
  readonly hasAccountTest: boolean;
};

export const PROVIDER_FLAGS: Readonly<Record<ProviderId, ProviderFlags>> = {
  anthropic: {
    binary: 'claude',
    statusSlot: 'providerStatus',
    shouldReplayHistoryAsText: false,
    hasAccountTest: true,
  },
  cursor: {
    binary: 'cursor-agent',
    statusSlot: 'cursorStatus',
    shouldReplayHistoryAsText: true,
    hasAccountTest: true,
  },
  codex: {
    binary: 'codex',
    statusSlot: 'codexStatus',
    shouldReplayHistoryAsText: true,
    hasAccountTest: true,
  },
  gemini: {
    binary: 'agy',
    statusSlot: 'geminiStatus',
    shouldReplayHistoryAsText: true,
    hasAccountTest: false,
  },
  opencode: {
    binary: 'opencode',
    statusSlot: null,
    shouldReplayHistoryAsText: false,
    hasAccountTest: false,
  },
  openrouter: {
    binary: 'opencode',
    statusSlot: null,
    shouldReplayHistoryAsText: false,
    hasAccountTest: false,
  },
  moonshot: {
    binary: 'opencode',
    statusSlot: null,
    shouldReplayHistoryAsText: false,
    hasAccountTest: false,
  },
};

type Params = {
  readonly id: ProviderId;
};

export const providerFlags = ({ id }: Params): ProviderFlags => PROVIDER_FLAGS[id];

export const providersOnSameBinary = ({ id }: Params): ReadonlyArray<ProviderId> => {
  const { binary } = PROVIDER_FLAGS[id];
  return PROVIDER_IDS.filter((candidate) => PROVIDER_FLAGS[candidate].binary === binary);
};
