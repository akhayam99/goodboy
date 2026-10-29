import { isApiProvider, providerFlags } from '@goodboy/core';
import { invokeCommand } from '../../shared/lib/invokeCommand';
import { PROVIDER_LABEL } from './providerLabel';
import type {
  ProviderConnectionState,
  ProviderHealthStanding,
  ProviderInfo as ProviderInfoBase,
  ProviderId,
} from '@goodboy/types';

type AuthStateKind = 'connected' | 'disconnected' | 'unknown';

type ProbeErrorKind = 'notFound' | 'timeout' | 'exit';

export type AuthReason =
  | { readonly kind: 'timed_out'; readonly secs: number }
  | { readonly kind: 'not_installed' }
  | { readonly kind: 'spawn_failed'; readonly detail: string }
  | { readonly kind: 'cli_said'; readonly detail: string }
  | { readonly kind: 'printed_nothing' }
  | { readonly kind: 'exited_with_code'; readonly code: number }
  | { readonly kind: 'no_exit_code' }
  | { readonly kind: 'empty_command' }
  | { readonly kind: 'no_access_token' }
  | { readonly kind: 'not_confirmed_by_server' }
  | { readonly kind: 'no_status' }
  | { readonly kind: 'unknown_provider' }
  | { readonly kind: 'check_unfinished' };

export type AuthState = {
  readonly state: AuthStateKind;
  readonly identity: string | null;
  readonly plan?: string | null;
  readonly verified?: boolean;
  readonly reason?: AuthReason | null;
};

export type { ProviderId };

export type ProviderStatus = {
  readonly id: string;
  readonly binary: string;
  readonly available: boolean;
  readonly version: string | null;
  readonly error: string | null;
  readonly path?: string | null;
  readonly errorKind?: ProbeErrorKind | null;
};

export type ProviderDisplayInfo = ProviderInfoBase & {
  readonly label: string;
  readonly error: string | null;
  readonly errorKind?: ProbeErrorKind | null;
  readonly docsUrl: string;
  readonly standing?: ProviderHealthStanding;
  readonly isBreakerOpen?: boolean;
};

const PROVIDER_DOCS: Record<ProviderId, string> = {
  anthropic: 'https://docs.claude.com/en/docs/claude-code/overview',
  cursor: 'https://docs.cursor.com/en/cli/installation',
  codex: 'https://github.com/openai/codex#installation',
  gemini: 'https://antigravity.google/cli',
  copilot: 'https://docs.github.com/copilot/how-tos/copilot-cli',
  opencode: 'https://opencode.ai/docs',
  openrouter: 'https://openrouter.ai/docs',
  moonshot: 'https://platform.moonshot.ai/docs',
};

const TAURI_REFRESH_CMD: Record<ProviderId, string> = {
  anthropic: 'refresh_provider_status',
  cursor: 'refresh_cursor_status',
  codex: 'refresh_codex_status',
  gemini: 'refresh_gemini_status',
  copilot: 'refresh_copilot_status',
  opencode: 'refresh_opencode_status',
  openrouter: 'refresh_openrouter_status',
  moonshot: 'refresh_moonshot_status',
};

const EMPTY_CAPABILITIES: ProviderInfoBase['capabilities'] = {
  models: [],
};

type RefreshParams = {
  readonly id: ProviderId;
};

export const refreshProviderDetection = async ({ id }: RefreshParams): Promise<ProviderStatus> => {
  return invokeCommand<ProviderStatus>(TAURI_REFRESH_CMD[id]);
};

export const checkProviderAuth = async (providerId: ProviderId): Promise<AuthState> => {
  return invokeCommand<AuthState>('check_provider_auth', { providerId });
};

export type ProviderAuthResults = Partial<Readonly<Record<ProviderId, AuthState | null>>>;

const isNoAnswerStatus = (status: ProviderStatus): boolean =>
  !status.available && (status.errorKind === 'timeout' || status.errorKind === 'exit');

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
    return isNoAnswerStatus(status) ? 'unknown' : 'missing';
  }
  return hasCredential ? 'connected' : 'installed_disconnected';
};

function connectionFromDetectionAndAuth(
  status: ProviderStatus,
  auth: AuthState | null,
): ProviderConnectionState {
  if (isNoAnswerStatus(status)) {
    return 'unknown';
  }
  if (!status.available) {
    return status.error ? 'error' : 'missing';
  }
  if (!auth || auth.state === 'unknown') {
    return 'unknown';
  }
  if (auth.state === 'disconnected') {
    return 'installed_disconnected';
  }
  return 'connected';
}

const OPENCODE_FREE_MODELS_IDENTITY = 'Free models';

function providerInfoFromStatus(
  id: ProviderId,
  status: ProviderStatus | null,
  auth: AuthState | null,
  hasCredential: boolean,
): ProviderDisplayInfo {
  const base = {
    id,
    label: PROVIDER_LABEL[id],
    binary: status?.binary ?? providerFlags({ id }).binary,
    capabilities: EMPTY_CAPABILITIES,
    identity: auth?.identity ?? null,
    docsUrl: PROVIDER_DOCS[id],
    ...(status?.errorKind !== undefined &&
      status.errorKind !== null && { errorKind: status.errorKind }),
  };
  if (id === 'anthropic') {
    if (!status) {
      return { ...base, connection: 'unknown', version: null, error: null };
    }
    const connection = connectionFromDetectionAndAuth(status, auth);
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
    return {
      ...base,
      connection: isNoAnswerStatus(status) ? 'unknown' : 'missing',
      version: null,
      error: status.error ?? null,
    };
  }
  if (id === 'opencode') {
    return {
      ...base,
      identity: auth?.identity ?? OPENCODE_FREE_MODELS_IDENTITY,
      connection: 'connected',
      version: status.version,
      error: null,
    };
  }
  if (id === 'gemini' && hasCredential) {
    return { ...base, connection: 'connected', version: status.version, error: null };
  }
  const connection = connectionFromDetectionAndAuth(status, auth);
  return { ...base, connection, version: status.version, error: null };
}

type ApiInfoParams = {
  readonly id: ProviderId;
  readonly status: ProviderStatus | null;
  readonly hasCredential: boolean;
};

const apiProviderInfo = ({ id, status, hasCredential }: ApiInfoParams): ProviderDisplayInfo => {
  const isAvailable = status?.available === true;
  return {
    id,
    label: PROVIDER_LABEL[id],
    binary: providerFlags({ id }).binary,
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
  readonly copilot: ProviderStatus | null;
  readonly opencode: ProviderStatus | null;
  readonly openrouter: ProviderStatus | null;
  readonly moonshot: ProviderStatus | null;
};

export const buildProviderList = (
  statuses: ProviderStatuses,
  auth?: ProviderAuthResults,
  credentialProviderIds: ReadonlySet<ProviderId> = new Set(),
): ReadonlyArray<ProviderDisplayInfo> => {
  const ids: ProviderId[] = [
    'anthropic',
    'cursor',
    'codex',
    'gemini',
    'copilot',
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
    return providerInfoFromStatus(
      id,
      statuses[id],
      auth?.[id] ?? null,
      credentialProviderIds.has(id),
    );
  });
};
