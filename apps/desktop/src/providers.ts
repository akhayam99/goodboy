import { invoke } from '@tauri-apps/api/core';
import type {
  ProviderConnectionState,
  ProviderInfo as ProviderInfoBase,
  ProviderId,
} from '@kay-am/types';

export type { ProviderId, ProviderConnectionState };

export interface ProviderStatus {
  readonly id: string;
  readonly binary: string;
  readonly available: boolean;
  readonly version: string | null;
  readonly error: string | null;
}

export interface ProviderInfo extends ProviderInfoBase {
  readonly label: string;
  readonly error: string | null;
  readonly docsUrl: string;
  readonly trackingIssueUrl?: string;
}

const PROVIDER_LABEL: Record<ProviderId, string> = {
  anthropic: 'claude',
  cursor: 'cursor',
  codex: 'codex',
};

const PROVIDER_DOCS: Record<ProviderId, string> = {
  anthropic: 'https://docs.claude.com/en/docs/claude-code/overview',
  cursor: 'https://docs.cursor.com/cli',
  codex: 'https://github.com/openai/codex',
};

const TRACKING_ISSUES: Partial<Record<ProviderId, string>> = {
  cursor: 'https://github.com/akhayam99/kay-am/issues/68',
  codex: 'https://github.com/akhayam99/kay-am/issues/69',
};

const EMPTY_CAPABILITIES: ProviderInfoBase['capabilities'] = {
  models: [],
  supportsTools: false,
  supportsStream: false,
  supportsCheapModel: false,
};

export async function getProviderStatus(): Promise<ProviderStatus> {
  return invoke<ProviderStatus>('get_provider_status');
}

export async function refreshProviderStatus(): Promise<ProviderStatus> {
  return invoke<ProviderStatus>('refresh_provider_status');
}

function claudeInfoFromStatus(status: ProviderStatus | null): ProviderInfo {
  const id: ProviderId = 'anthropic';
  const base = {
    id,
    label: PROVIDER_LABEL[id],
    binary: status?.binary ?? 'claude',
    capabilities: EMPTY_CAPABILITIES,
    identity: null,
    docsUrl: PROVIDER_DOCS[id],
  };
  if (!status) {
    return { ...base, connection: 'missing', version: null, error: null };
  }
  if (status.available) {
    return { ...base, connection: 'connected', version: status.version, error: null };
  }
  return {
    ...base,
    connection: status.error ? 'error' : 'missing',
    version: null,
    error: status.error,
  };
}

function placeholder(id: ProviderId, binary: string): ProviderInfo {
  return {
    id,
    label: PROVIDER_LABEL[id],
    binary,
    capabilities: EMPTY_CAPABILITIES,
    identity: null,
    connection: 'coming-soon',
    version: null,
    error: null,
    docsUrl: PROVIDER_DOCS[id],
    trackingIssueUrl: TRACKING_ISSUES[id],
  };
}

export function buildProviderList(claude: ProviderStatus | null): ReadonlyArray<ProviderInfo> {
  return [
    claudeInfoFromStatus(claude),
    placeholder('cursor', 'cursor-agent'),
    placeholder('codex', 'codex'),
  ];
}
