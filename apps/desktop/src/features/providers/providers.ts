import { invoke } from '@tauri-apps/api/core';
import type {
  ProviderConnectionState,
  ProviderInfo as ProviderInfoBase,
  ProviderId,
} from '@goodboy/types';

type AuthStateKind = 'connected' | 'disconnected' | 'unknown';

export type AuthState = {
  readonly state: AuthStateKind;
  readonly identity: string | null;
};

export type { ProviderId, ProviderConnectionState };

export type ProviderStatus = {
  readonly id: string;
  readonly binary: string;
  readonly available: boolean;
  readonly version: string | null;
  readonly error: string | null;
};

export type ProviderInfo = ProviderInfoBase & {
  readonly label: string;
  readonly error: string | null;
  readonly docsUrl: string;
};

export const PROVIDER_LABEL_LOWER: Record<ProviderId, string> = {
  anthropic: 'claude',
  cursor: 'cursor',
  codex: 'codex',
  gemini: 'gemini',
};

const PROVIDER_DOCS: Record<ProviderId, string> = {
  anthropic: 'https://docs.claude.com/en/docs/claude-code/overview',
  cursor: 'https://docs.cursor.com/en/cli/installation',
  codex: 'https://github.com/openai/codex#installation',
  gemini: 'https://antigravity.google/cli',
};

const PROVIDER_DEFAULT_BINARY: Record<ProviderId, string> = {
  anthropic: 'claude',
  cursor: 'cursor-agent',
  codex: 'codex',
  gemini: 'agy',
};

const TAURI_GET_CMD: Record<ProviderId, string> = {
  anthropic: 'get_provider_status',
  cursor: 'get_cursor_status',
  codex: 'get_codex_status',
  gemini: 'get_gemini_status',
};

const EMPTY_CAPABILITIES: ProviderInfoBase['capabilities'] = {
  models: [],
  supportsTools: false,
  supportsStream: false,
  supportsCheapModel: false,
};

export const getProviderStatus = async (id: ProviderId): Promise<ProviderStatus> => {
  return invoke<ProviderStatus>(TAURI_GET_CMD[id]);
};

export const getCursorStatus = (): Promise<ProviderStatus> => getProviderStatus('cursor');
export const getCodexStatus = (): Promise<ProviderStatus> => getProviderStatus('codex');
export const getGeminiStatus = (): Promise<ProviderStatus> => getProviderStatus('gemini');

export const checkProviderAuth = async (providerId: ProviderId): Promise<AuthState> => {
  return invoke<AuthState>('check_provider_auth', { providerId });
};

export type ProviderAuthResults = Readonly<Record<ProviderId, AuthState | null>>;

function connectionFromDetectionAndAuth(
  available: boolean,
  detectionError: string | null,
  auth: AuthState | null,
): ProviderConnectionState {
  if (!available) {
    return detectionError ? 'error' : 'missing';
  }
  if (!auth || auth.state === 'unknown') {
    return 'installed_disconnected';
  }
  if (auth.state === 'disconnected') {
    return 'installed_disconnected';
  }
  return 'connected';
}

function providerInfoFromStatus(
  id: ProviderId,
  status: ProviderStatus | null,
  auth: AuthState | null,
): ProviderInfo {
  const base = {
    id,
    label: PROVIDER_LABEL_LOWER[id],
    binary: status?.binary ?? PROVIDER_DEFAULT_BINARY[id],
    capabilities: EMPTY_CAPABILITIES,
    identity: auth?.identity ?? null,
    docsUrl: PROVIDER_DOCS[id],
  };
  if (id === 'anthropic') {
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
  if (!status || !status.available) {
    return { ...base, connection: 'missing', version: null, error: status?.error ?? null };
  }
  const connection = connectionFromDetectionAndAuth(status.available, status.error, auth);
  return { ...base, connection, version: status.version, error: null };
}

export type ProviderStatuses = {
  readonly anthropic: ProviderStatus | null;
  readonly cursor: ProviderStatus | null;
  readonly codex: ProviderStatus | null;
  readonly gemini: ProviderStatus | null;
};

export const buildProviderList = (
  statuses: ProviderStatuses,
  auth?: ProviderAuthResults,
): ReadonlyArray<ProviderInfo> => {
  const ids: ProviderId[] = ['anthropic', 'cursor', 'codex', 'gemini'];
  return ids.map((id) => providerInfoFromStatus(id, statuses[id], auth?.[id] ?? null));
};
