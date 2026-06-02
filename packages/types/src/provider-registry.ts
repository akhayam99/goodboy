export type ProviderId = 'anthropic' | 'cursor' | 'codex' | 'gemini';

export type ProviderConnectionState = 'connected' | 'installed_disconnected' | 'missing' | 'error';

export interface ModelTier {
  readonly id: string;
  readonly tier: 'turn' | 'cheap';
  readonly contextWindow: number;
}

export interface ProviderRegistryCapabilities {
  readonly models: ReadonlyArray<ModelTier>;
  readonly supportsTools: boolean;
  readonly supportsStream: boolean;
  readonly supportsCheapModel: boolean;
}

export interface ProviderInfo {
  readonly id: ProviderId;
  readonly binary: string;
  readonly capabilities: ProviderRegistryCapabilities;
  readonly connection: ProviderConnectionState;
  readonly version: string | null;
  readonly identity: string | null;
}

export const PROVIDER_API_KEY_ENV: Record<ProviderId, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  cursor: 'CURSOR_API_KEY',
  codex: 'OPENAI_API_KEY',
  gemini: 'GEMINI_API_KEY',
};
