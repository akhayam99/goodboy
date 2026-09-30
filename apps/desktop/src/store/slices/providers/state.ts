import type {
  ProviderStatus,
  ProviderAuthResults,
  ProviderDisplayInfo,
} from '../../../features/providers/providers';
import { buildProviderList } from '../../../features/providers/providers';
import type { ProviderLifecycleMap, ProviderConnectMap } from './types';
import { INITIAL_LIFECYCLE_MAP, INITIAL_CONNECT_MAP } from './types';
import type { CliRequirement } from '@goodboy/core';
import type { ProviderCooldowns } from '../../../features/providers/routing';

export type ProvidersState = {
  readonly providerStatus: ProviderStatus | null;
  readonly cursorStatus: ProviderStatus | null;
  readonly codexStatus: ProviderStatus | null;
  readonly geminiStatus: ProviderStatus | null;
  readonly authResults: ProviderAuthResults | null;
  readonly providers: ReadonlyArray<ProviderDisplayInfo>;
  readonly providerLifecycle: ProviderLifecycleMap;
  readonly providerConnect: ProviderConnectMap;
  readonly cliRequirements: ReadonlyArray<CliRequirement>;
  readonly providerCooldowns: ProviderCooldowns;
};

export const providersInitialState: ProvidersState = {
  providerStatus: null,
  cursorStatus: null,
  codexStatus: null,
  geminiStatus: null,
  authResults: null,
  providers: buildProviderList({
    anthropic: null,
    cursor: null,
    codex: null,
    gemini: null,
    opencode: null,
    openrouter: null,
    moonshot: null,
  }),
  providerLifecycle: INITIAL_LIFECYCLE_MAP,
  providerConnect: INITIAL_CONNECT_MAP,
  cliRequirements: [],
  providerCooldowns: {},
};
