import { PROVIDER_IDS, type ProviderId } from '@goodboy/types';

export type ProviderStatusSlot = 'providerStatus' | 'cursorStatus' | 'codexStatus' | 'geminiStatus';

export type ProviderFlags = {
  readonly binary: string;
  readonly statusSlot: ProviderStatusSlot | null;
  readonly shouldReplayHistoryAsText: boolean;
  readonly hasAccountTest: boolean;
  readonly canFollowRules: boolean;
  readonly canTakeLeadDelta: boolean;
};

export const PROVIDER_FLAGS: Readonly<Record<ProviderId, ProviderFlags>> = {
  anthropic: {
    binary: 'claude',
    statusSlot: 'providerStatus',
    shouldReplayHistoryAsText: false,
    hasAccountTest: true,
    canFollowRules: true,
    canTakeLeadDelta: true,
  },
  cursor: {
    binary: 'cursor-agent',
    statusSlot: 'cursorStatus',
    shouldReplayHistoryAsText: true,
    hasAccountTest: true,
    canFollowRules: false,
    canTakeLeadDelta: false,
  },
  codex: {
    binary: 'codex',
    statusSlot: 'codexStatus',
    shouldReplayHistoryAsText: true,
    hasAccountTest: true,
    canFollowRules: false,
    canTakeLeadDelta: false,
  },
  gemini: {
    binary: 'agy',
    statusSlot: 'geminiStatus',
    shouldReplayHistoryAsText: true,
    hasAccountTest: false,
    canFollowRules: false,
    canTakeLeadDelta: false,
  },
  copilot: {
    binary: 'copilot',
    statusSlot: null,
    shouldReplayHistoryAsText: false,
    hasAccountTest: false,
    canFollowRules: false,
    canTakeLeadDelta: false,
  },
  opencode: {
    binary: 'opencode',
    statusSlot: null,
    shouldReplayHistoryAsText: false,
    hasAccountTest: false,
    canFollowRules: false,
    canTakeLeadDelta: false,
  },
  openrouter: {
    binary: 'opencode',
    statusSlot: null,
    shouldReplayHistoryAsText: false,
    hasAccountTest: false,
    canFollowRules: false,
    canTakeLeadDelta: false,
  },
  moonshot: {
    binary: 'opencode',
    statusSlot: null,
    shouldReplayHistoryAsText: false,
    hasAccountTest: false,
    canFollowRules: false,
    canTakeLeadDelta: false,
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
