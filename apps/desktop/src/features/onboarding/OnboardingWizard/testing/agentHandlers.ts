import type { ProviderId } from '@goodboy/types';

type StatusParams = {
  readonly id: string;
  readonly binary: string;
  readonly version?: string;
  readonly error?: string;
  readonly errorKind?: 'notFound' | 'timeout' | 'exit';
};

export const agentStatus = ({ id, binary, version, error, errorKind }: StatusParams) => ({
  id,
  binary,
  available: version !== undefined,
  version: version ?? null,
  error: error ?? (version === undefined ? 'not found' : null),
  errorKind: errorKind ?? (version === undefined ? 'notFound' : null),
});

type AuthArgs = {
  readonly providerId?: ProviderId;
};

type AgentsParams = {
  readonly signedIn: ReadonlyArray<ProviderId>;
  readonly codexVersion?: string;
  readonly claudeVersion?: string;
  readonly copilotVersion?: string;
};

export const agentHandlers = ({
  signedIn,
  codexVersion,
  claudeVersion,
  copilotVersion,
}: AgentsParams) => ({
  refresh_provider_status: agentStatus({
    id: 'anthropic',
    binary: 'claude',
    ...(claudeVersion === undefined ? {} : { version: claudeVersion }),
  }),
  refresh_codex_status: agentStatus({
    id: 'codex',
    binary: 'codex',
    ...(codexVersion === undefined ? {} : { version: codexVersion }),
  }),
  refresh_cursor_status: agentStatus({ id: 'cursor', binary: 'cursor-agent' }),
  refresh_gemini_status: agentStatus({ id: 'gemini', binary: 'agy' }),
  refresh_copilot_status: agentStatus({
    id: 'copilot',
    binary: 'copilot',
    ...(copilotVersion === undefined ? {} : { version: copilotVersion }),
  }),
  check_provider_auth: (args: AuthArgs | undefined) =>
    args?.providerId !== undefined && signedIn.includes(args.providerId)
      ? { state: 'connected', identity: 'dana@northwind.dev' }
      : { state: 'disconnected', identity: null },
});
