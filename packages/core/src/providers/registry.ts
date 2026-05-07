import { spawn } from 'node:child_process';
import type {
  IsoDateTime,
  ProviderAdapter,
  ProviderId,
  ProviderRegistryCapabilities,
} from '@kay-am/types';
import { ClaudeAdapter } from './claude/adapter';
import { CursorAdapter } from './cursor/adapter';
import { CodexAdapter } from './codex/adapter';
import { PROVIDER_CAPABILITIES } from './capabilities';

export type { ProviderRegistryCapabilities };

export interface ProviderDeps {
  readonly binary?: string;
  readonly now?: () => IsoDateTime;
  readonly spawnFn?: typeof spawn;
  readonly onUnknown?: (type: string, payload: unknown) => void;
}

export class UnknownProviderError extends Error {
  constructor(id: string) {
    super(`unknown provider: ${id}`);
    this.name = 'UnknownProviderError';
  }
}

export function createProvider(id: ProviderId, deps: ProviderDeps = {}): ProviderAdapter {
  switch (id) {
    case 'anthropic':
      return new ClaudeAdapter(deps);
    case 'cursor':
      return new CursorAdapter(deps);
    case 'codex':
      return new CodexAdapter(deps);
    default: {
      const _exhaustive: never = id;
      throw new UnknownProviderError(_exhaustive);
    }
  }
}

export function listSupportedProviders(): ReadonlyArray<ProviderId> {
  return ['anthropic', 'cursor', 'codex'];
}

export function getCapabilities(id: ProviderId): ProviderRegistryCapabilities {
  return PROVIDER_CAPABILITIES[id];
}
