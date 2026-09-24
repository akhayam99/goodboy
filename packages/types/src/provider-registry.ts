import type { ModelRoutingProfile } from './workflow-routing';

export type ProviderId =
  'anthropic' | 'cursor' | 'codex' | 'gemini' | 'opencode' | 'openrouter' | 'moonshot';

export const PROVIDER_IDS = [
  'anthropic',
  'cursor',
  'codex',
  'gemini',
  'opencode',
  'openrouter',
  'moonshot',
] as const satisfies readonly ProviderId[];

type Expect<T extends true> = T;
type ProviderIdsAreTotal =
  Exclude<ProviderId, (typeof PROVIDER_IDS)[number]> extends never ? true : false;
type _ProviderIdsTotalCheck = Expect<ProviderIdsAreTotal>;

export type ProviderConnectionState =
  'connected' | 'installed_disconnected' | 'missing' | 'error' | 'unknown';

export type ModelFamily =
  'claude' | 'gpt' | 'codex' | 'gemini' | 'composer' | 'cursor-auto' | 'other';

export type ModelCostTier = 'cheap' | 'mid' | 'expensive';

export type ModelPrice = {
  readonly inputPerMtok: number;
  readonly outputPerMtok: number;
  readonly cachedInputPerMtok?: number;
  readonly assumed?: true;
};

export type EffortLevel = 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export type ModelTier = 'turn' | 'cheap';

export type ModelDescriptor = {
  readonly id: string;
  readonly tier: ModelTier;
  readonly contextWindow: number;
  readonly family: ModelFamily;
  readonly subfamily: string | null;
  readonly label: string;
  readonly variantLabel: string;
  readonly costTier: ModelCostTier;
  readonly weight: number;
  readonly effort: ReadonlyArray<EffortLevel> | null;
  readonly thinkerOnly: boolean;
  readonly routingProfile: ModelRoutingProfile | null;
};

export type ProviderRegistryCapabilities = {
  readonly models: ReadonlyArray<ModelDescriptor>;
  readonly supportsTools: boolean;
  readonly supportsStream: boolean;
  readonly supportsCheapModel: boolean;
};

export type ProviderInfo = {
  readonly id: ProviderId;
  readonly binary: string;
  readonly capabilities: ProviderRegistryCapabilities;
  readonly connection: ProviderConnectionState;
  readonly version: string | null;
  readonly identity: string | null;
};
