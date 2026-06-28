import { spawn } from 'node:child_process';
import type {
  IsoDateTime,
  ProviderAdapter,
  ProviderId,
  ProviderRegistryCapabilities,
} from '@goodboy/types';
import { ClaudeAdapter } from './claude/adapter';
import { CursorAdapter } from './cursor/adapter';
import { CodexAdapter } from './codex/adapter';
import { GeminiAdapter } from './gemini/adapter';
import { OpenCodeAdapter } from './opencode/adapter';
import { PROVIDER_CAPABILITIES } from './capabilities';

export type { ProviderRegistryCapabilities };

export type ProviderDeps = {
  readonly binary?: string;
  readonly now?: () => IsoDateTime;
  readonly spawnFn?: typeof spawn;
  readonly onUnknown?: (type: string, payload: unknown) => void;
};

export class UnknownProviderError extends Error {
  constructor(id: string) {
    super(`unknown provider: ${id}`);
    this.name = 'UnknownProviderError';
  }
}

export const createProvider = (id: ProviderId, deps: ProviderDeps = {}): ProviderAdapter => {
  switch (id) {
    case 'anthropic':
      return new ClaudeAdapter(deps);
    case 'cursor':
      return new CursorAdapter(deps);
    case 'codex':
      return new CodexAdapter(deps);
    case 'gemini':
      return new GeminiAdapter(deps);
    case 'opencode':
      return new OpenCodeAdapter(deps);
    default: {
      const _exhaustive: never = id;
      throw new UnknownProviderError(_exhaustive);
    }
  }
};

export const listSupportedProviders = (): ReadonlyArray<ProviderId> => {
  return ['anthropic', 'cursor', 'codex', 'gemini', 'opencode'];
};

export const getCapabilities = (id: ProviderId): ProviderRegistryCapabilities => {
  return PROVIDER_CAPABILITIES[id];
};
