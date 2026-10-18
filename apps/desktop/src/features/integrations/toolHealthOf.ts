import type { IntegrationGlyphProvider } from './components/IntegrationGlyph';
import type { CredentialSecretState } from './useCredentialSecret';

type ToolSignal = 'none' | 'warn' | 'danger';

export type ToolHealth = {
  readonly signal: ToolSignal;
  readonly chip: string | null;
  readonly reason: string | null;
};

type Params = {
  readonly tool: IntegrationGlyphProvider;
  readonly isConnected: boolean;
  readonly secret: CredentialSecretState;
};

const HEALTHY_TOOL: ToolHealth = { signal: 'none', chip: null, reason: null };

const KEY_MISSING: ToolHealth = {
  signal: 'danger',
  chip: 'Key missing',
  reason: 'Key missing on this Mac',
};

export const toolHealthOf = ({ tool, isConnected, secret }: Params): ToolHealth => {
  if (!isConnected || tool === 'github') {
    return HEALTHY_TOOL;
  }
  if (secret === 'missing') {
    return KEY_MISSING;
  }
  return HEALTHY_TOOL;
};
