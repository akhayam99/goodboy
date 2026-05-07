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

export async function getCursorStatus(): Promise<ProviderStatus> {
  return invoke<ProviderStatus>('get_cursor_status');
}

export async function refreshCursorStatus(): Promise<ProviderStatus> {
  return invoke<ProviderStatus>('refresh_cursor_status');
}

export async function getCodexStatus(): Promise<ProviderStatus> {
  return invoke<ProviderStatus>('get_codex_status');
}

export async function refreshCodexStatus(): Promise<ProviderStatus> {
  return invoke<ProviderStatus>('refresh_codex_status');
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

function cursorInfoFromStatus(status: ProviderStatus | null): ProviderInfo {
  const id: ProviderId = 'cursor';
  const base = {
    id,
    label: PROVIDER_LABEL[id],
    binary: status?.binary ?? 'cursor-agent',
    capabilities: EMPTY_CAPABILITIES,
    identity: null,
    docsUrl: PROVIDER_DOCS[id],
    trackingIssueUrl: TRACKING_ISSUES[id],
  };
  if (!status || !status.available) {
    return { ...base, connection: 'missing', version: null, error: status?.error ?? null };
  }
  return { ...base, connection: 'installed_disconnected', version: status.version, error: null };
}

function codexInfoFromStatus(status: ProviderStatus | null): ProviderInfo {
  const id: ProviderId = 'codex';
  const base = {
    id,
    label: PROVIDER_LABEL[id],
    binary: status?.binary ?? 'codex',
    capabilities: EMPTY_CAPABILITIES,
    identity: null,
    docsUrl: PROVIDER_DOCS[id],
    trackingIssueUrl: TRACKING_ISSUES[id],
  };
  if (!status || !status.available) {
    return { ...base, connection: 'missing', version: null, error: status?.error ?? null };
  }
  return { ...base, connection: 'installed_disconnected', version: status.version, error: null };
}

export interface ProviderStatuses {
  readonly anthropic: ProviderStatus | null;
  readonly cursor: ProviderStatus | null;
  readonly codex: ProviderStatus | null;
}

export function buildProviderList(statuses: ProviderStatuses): ReadonlyArray<ProviderInfo>;
export function buildProviderList(anthropic: ProviderStatus | null): ReadonlyArray<ProviderInfo>;
export function buildProviderList(
  arg: ProviderStatus | null | ProviderStatuses,
): ReadonlyArray<ProviderInfo> {
  if (arg === null || (typeof arg === 'object' && 'available' in arg)) {
    return [
      claudeInfoFromStatus(arg as ProviderStatus | null),
      cursorInfoFromStatus(null),
      codexInfoFromStatus(null),
    ];
  }
  const { anthropic, cursor, codex } = arg as ProviderStatuses;
  return [
    claudeInfoFromStatus(anthropic),
    cursorInfoFromStatus(cursor),
    codexInfoFromStatus(codex),
  ];
}
