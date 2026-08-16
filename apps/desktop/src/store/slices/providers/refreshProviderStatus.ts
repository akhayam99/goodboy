import {
  buildProviderList,
  type ProviderInfo,
  type ProviderStatus,
  type ProviderStatuses,
} from '../../../features/providers/providers';
import type { ProviderId } from '@goodboy/types';
import type { SetFn } from './types';

type StatusParams = {
  readonly providers: ReadonlyArray<ProviderInfo>;
  readonly id: ProviderId;
};

const statusFor = ({ providers, id }: StatusParams): ProviderStatus | null => {
  const info = providers.find((provider) => provider.id === id);
  if (info === undefined) {
    return null;
  }
  return {
    id,
    binary: info.binary,
    available:
      info.connection !== 'missing' && info.connection !== 'error' && info.connection !== 'unknown',
    version: info.version,
    error: info.error,
  };
};

export const refreshProviderStatus = (set: SetFn) => {
  return (status: ProviderStatus) => {
    set((state) => {
      const statuses: ProviderStatuses = {
        anthropic: status,
        cursor: state.cursorStatus,
        codex: state.codexStatus,
        gemini: state.geminiStatus,
        opencode: statusFor({ providers: state.providers, id: 'opencode' }),
        openrouter: statusFor({ providers: state.providers, id: 'openrouter' }),
        moonshot: statusFor({ providers: state.providers, id: 'moonshot' }),
      };
      return {
        providerStatus: status,
        providers: buildProviderList(
          statuses,
          state.authResults ?? undefined,
          new Set(state.providerCredentials.map((item) => item.providerId)),
        ),
      };
    });
  };
};
