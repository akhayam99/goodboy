import { invoke } from '@tauri-apps/api/core';
import type {
  ProviderConnectionState,
  ProviderInfo as ProviderInfoBase,
  ProviderId,
} from '@goodboy/types';
import { isApiProvider } from '@goodboy/types';

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
  opencode: 'opencode',
  openrouter: 'openrouter',
  moonshot: 'moonshot',
};

const PROVIDER_DOCS: Record<ProviderId, string> = {
  anthropic: 'https://docs.claude.com/en/docs/claude-code/overview',
  cursor: 'https://docs.cursor.com/en/cli/installation',
  codex: 'https://github.com/openai/codex#installation',
  gemini: 'https://antigravity.google/cli',
  opencode: 'https://opencode.ai/docs',
  openrouter: 'https://openrouter.ai/docs',
  moonshot: 'https://platform.moonshot.ai/docs',
};

const PROVIDER_DEFAULT_BINARY: Record<ProviderId, string> = {
  anthropic: 'claude',
  cursor: 'cursor-agent',
  codex: 'codex',
  gemini: 'agy',
  opencode: 'opencode',
  openrouter: 'opencode',
  moonshot: 'opencode',
};

const TAURI_GET_CMD: Record<ProviderId, string> = {
  anthropic: 'get_provider_status',
  cursor: 'get_cursor_status',
  codex: 'get_codex_status',
  gemini: 'get_gemini_status',
  opencode: 'get_opencode_status',
  openrouter: 'get_openrouter_status',
  moonshot: 'get_moonshot_status',
};

const TAURI_REFRESH_CMD: Record<ProviderId, string> = {
  anthropic: 'refresh_provider_status',
  cursor: 'refresh_cursor_status',
  codex: 'refresh_codex_status',
  gemini: 'refresh_gemini_status',
  opencode: 'refresh_opencode_status',
  openrouter: 'refresh_openrouter_status',
  moonshot: 'refresh_moonshot_status',
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

type RefreshParams = {
  readonly id: ProviderId;
};

export const refreshProviderDetection = async ({ id }: RefreshParams): Promise<ProviderStatus> => {
  return invoke<ProviderStatus>(TAURI_REFRESH_CMD[id]);
};

export const checkProviderAuth = async (providerId: ProviderId): Promise<AuthState> => {
  return invoke<AuthState>('check_provider_auth', { providerId });
};

export type ProviderAuthResults = Partial<Readonly<Record<ProviderId, AuthState | null>>>;

type ApiConnectionParams = {
  readonly status: ProviderStatus | null;
  readonly hasCredential: boolean;
};

export const connectionForApiProvider = ({
  status,
  hasCredential,
}: ApiConnectionParams): ProviderConnectionState => {
  if (status === null) {
    return 'unknown';
  }
  if (status.available !== true) {
    return 'missing';
  }
  return hasCredential ? 'connected' : 'installed_disconnected';
};

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
      return { ...base, connection: 'unknown', version: null, error: null };
    }
    const connection = connectionFromDetectionAndAuth(status.available, status.error, auth);
    return {
      ...base,
      connection,
      version: status.available ? status.version : null,
      error: status.available ? null : status.error,
    };
  }
  if (status === null) {
    return { ...base, connection: 'unknown', version: null, error: null };
  }
  if (!status.available) {
    return { ...base, connection: 'missing', version: null, error: status.error ?? null };
  }
  const connection = connectionFromDetectionAndAuth(status.available, status.error, auth);
  return { ...base, connection, version: status.version, error: null };
}

type ApiInfoParams = {
  readonly id: ProviderId;
  readonly status: ProviderStatus | null;
  readonly hasCredential: boolean;
};

const apiProviderInfo = ({ id, status, hasCredential }: ApiInfoParams): ProviderInfo => {
  const isAvailable = status?.available === true;
  return {
    id,
    label: PROVIDER_LABEL_LOWER[id],
    binary: PROVIDER_DEFAULT_BINARY[id],
    capabilities: EMPTY_CAPABILITIES,
    identity: null,
    docsUrl: PROVIDER_DOCS[id],
    connection: connectionForApiProvider({ status, hasCredential }),
    version: isAvailable ? (status.version ?? null) : null,
    error: isAvailable ? null : (status?.error ?? null),
  };
};

export type ProviderStatuses = {
  readonly anthropic: ProviderStatus | null;
  readonly cursor: ProviderStatus | null;
  readonly codex: ProviderStatus | null;
  readonly gemini: ProviderStatus | null;
  readonly opencode: ProviderStatus | null;
  readonly openrouter: ProviderStatus | null;
  readonly moonshot: ProviderStatus | null;
};

export const buildProviderList = (
  statuses: ProviderStatuses,
  auth?: ProviderAuthResults,
  credentialProviderIds: ReadonlySet<ProviderId> = new Set(),
): ReadonlyArray<ProviderInfo> => {
  const ids: ProviderId[] = [
    'anthropic',
    'cursor',
    'codex',
    'gemini',
    'opencode',
    'openrouter',
    'moonshot',
  ];
  return ids.map((id) => {
    if (isApiProvider({ id })) {
      return apiProviderInfo({
        id,
        status: statuses[id],
        hasCredential: credentialProviderIds.has(id),
      });
    }
    return providerInfoFromStatus(id, statuses[id], auth?.[id] ?? null);
  });
};
