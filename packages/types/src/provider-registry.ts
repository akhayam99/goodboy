export type ProviderId = 'anthropic' | 'cursor' | 'codex' | 'gemini' | 'opencode' | 'openrouter';

export const PROVIDER_IDS = [
  'anthropic',
  'cursor',
  'codex',
  'gemini',
  'opencode',
  'openrouter',
] as const satisfies readonly ProviderId[];

export type ProviderConnectionState = 'connected' | 'installed_disconnected' | 'missing' | 'error';

export type ModelFamily =
  | 'claude'
  | 'gpt'
  | 'codex'
  | 'gemini'
  | 'composer'
  | 'cursor-auto'
  | 'other';

export type ModelCostTier = 'cheap' | 'mid' | 'expensive';

export type ModelEffort = 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';

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
  readonly effort: ReadonlyArray<ModelEffort> | null;
  readonly thinkerOnly: boolean;
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

export const PROVIDER_API_KEY_ENV: Readonly<Partial<Record<ProviderId, string>>> = {
  anthropic: 'ANTHROPIC_API_KEY',
  cursor: 'CURSOR_API_KEY',
  codex: 'OPENAI_API_KEY',
  gemini: 'GEMINI_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
};
