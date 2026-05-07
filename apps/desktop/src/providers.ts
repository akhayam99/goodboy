import { invoke } from '@tauri-apps/api/core';
import type {
  ProviderConnectionState,
  ProviderInfo as ProviderInfoBase,
  ProviderId,
} from '@kay-am/types';

export type AuthStateKind = 'connected' | 'disconnected' | 'unknown';

export interface AuthState {
  readonly state: AuthStateKind;
  readonly identity: string | null;
}

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

export async function checkProviderAuth(providerId: ProviderId): Promise<AuthState> {
  return invoke<AuthState>('check_provider_auth', { providerId });
}

export type ProviderAuthResults = Readonly<Record<ProviderId, AuthState | null>>;

function connectionFromDetectionAndAuth(
  available: boolean,
  detectionError: string | null,
  auth: AuthState | null,
): ProviderConnectionState {
  if (!available) {
    return detectionError ? 'error' : 'missing';
  }
  if (!auth || auth.state === 'unknown') return 'installed_disconnected';
  if (auth.state === 'disconnected') return 'installed_disconnected';
  return 'connected';
}

function claudeInfoFromStatus(status: ProviderStatus | null, auth: AuthState | null): ProviderInfo {
  const id: ProviderId = 'anthropic';
  const base = {
    id,
    label: PROVIDER_LABEL[id],
    binary: status?.binary ?? 'claude',
    capabilities: EMPTY_CAPABILITIES,
    identity: auth?.identity ?? null,
    docsUrl: PROVIDER_DOCS[id],
  };
  if (!status) {
    return { ...base, connection: 'missing', version: null, error: null };
  }
  const connection = connectionFromDetectionAndAuth(status.available, status.error, auth);
  return {
    ...base,
    connection,
    version: status.available ? status.version : null,
    error: status.available ? null : status.error,
  };
}

function cursorInfoFromStatus(status: ProviderStatus | null, auth: AuthState | null): ProviderInfo {
  const id: ProviderId = 'cursor';
  const base = {
    id,
    label: PROVIDER_LABEL[id],
    binary: status?.binary ?? 'cursor-agent',
    capabilities: EMPTY_CAPABILITIES,
    identity: auth?.identity ?? null,
    docsUrl: PROVIDER_DOCS[id],
    trackingIssueUrl: TRACKING_ISSUES[id],
  };
  if (!status || !status.available) {
    return { ...base, connection: 'missing', version: null, error: status?.error ?? null };
  }
  const connection = connectionFromDetectionAndAuth(status.available, status.error, auth);
  return { ...base, connection, version: status.version, error: null };
}

function codexInfoFromStatus(status: ProviderStatus | null, auth: AuthState | null): ProviderInfo {
  const id: ProviderId = 'codex';
  const base = {
    id,
    label: PROVIDER_LABEL[id],
    binary: status?.binary ?? 'codex',
    capabilities: EMPTY_CAPABILITIES,
    identity: auth?.identity ?? null,
    docsUrl: PROVIDER_DOCS[id],
    trackingIssueUrl: TRACKING_ISSUES[id],
  };
  if (!status || !status.available) {
    return { ...base, connection: 'missing', version: null, error: status?.error ?? null };
  }
  const connection = connectionFromDetectionAndAuth(status.available, status.error, auth);
  return { ...base, connection, version: status.version, error: null };
}

export interface ProviderStatuses {
  readonly anthropic: ProviderStatus | null;
  readonly cursor: ProviderStatus | null;
  readonly codex: ProviderStatus | null;
}

export function buildProviderList(
  statuses: ProviderStatuses,
  auth?: ProviderAuthResults,
): ReadonlyArray<ProviderInfo> {
  const { anthropic, cursor, codex } = statuses;
  return [
    claudeInfoFromStatus(anthropic, auth?.anthropic ?? null),
    cursorInfoFromStatus(cursor, auth?.cursor ?? null),
    codexInfoFromStatus(codex, auth?.codex ?? null),
  ];
}
