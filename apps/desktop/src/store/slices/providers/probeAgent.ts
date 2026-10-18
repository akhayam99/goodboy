import type { ProviderId } from '@goodboy/types';
import {
  checkProviderAuth,
  refreshProviderDetection,
  type ProviderAuthResults,
  type ProviderStatus,
  type ProviderStatuses,
} from '../../../features/providers/providers';
import { applyProviderProbe, takeProbeSeq } from './applyProviderProbe';
import { probeLock } from './probeLock';
import type { GetFn, SetFn } from './types';

export type AgentProviderId = Extract<ProviderId, 'anthropic' | 'codex' | 'cursor' | 'gemini'>;

export type ProbeAgentParams = {
  readonly providerId: AgentProviderId;
  readonly isCurrent: () => boolean;
};

type StoredParams = {
  readonly get: GetFn;
  readonly providerId: ProviderId;
};

const storedStatus = ({ get, providerId }: StoredParams): ProviderStatus | null => {
  const info = get().providers.find((provider) => provider.id === providerId);
  if (info === undefined || info.connection === 'unknown') {
    return null;
  }
  return {
    id: providerId,
    binary: info.binary,
    available: info.version !== null && info.version !== undefined,
    version: info.version ?? null,
    error: info.error,
  };
};

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
};

export const probeAgent =
  ({ set, get }: Params) =>
  ({ providerId, isCurrent }: ProbeAgentParams): Promise<void> =>
    probeLock({
      get,
      providerId,
      kind: 'status',
      isAutomatic: false,
      run: async () => {
        const status = await refreshProviderDetection({ id: providerId });
        const auth = status.available ? await checkProviderAuth(providerId) : null;
        if (!isCurrent()) {
          return;
        }
        const state = get();
        const statuses: ProviderStatuses = {
          anthropic: state.providerStatus,
          cursor: state.cursorStatus,
          codex: state.codexStatus,
          gemini: state.geminiStatus,
          opencode: storedStatus({ get, providerId: 'opencode' }),
          openrouter: storedStatus({ get, providerId: 'openrouter' }),
          moonshot: storedStatus({ get, providerId: 'moonshot' }),
          [providerId]: status,
        };
        const authResults: ProviderAuthResults = {
          ...(state.authResults ?? {}),
          [providerId]: auth,
        };
        applyProviderProbe({
          set,
          get,
          seq: takeProbeSeq(),
          statuses,
          authResults,
          only: [providerId],
          patch: {
            providerStatus: statuses.anthropic,
            cursorStatus: statuses.cursor,
            codexStatus: statuses.codex,
            geminiStatus: statuses.gemini,
          },
        });
      },
    });
