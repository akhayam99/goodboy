import {
  buildProviderList,
  type ProviderStatus,
  type ProviderStatuses,
} from '../../../features/providers/providers';
import type { SetFn } from './types';

export function refreshProviderStatus(set: SetFn) {
  return (status: ProviderStatus) => {
    set((state) => {
      const statuses: ProviderStatuses = {
        anthropic: status,
        cursor: state.cursorStatus,
        codex: state.codexStatus,
      };
      return {
        providerStatus: status,
        providers: buildProviderList(statuses, state.authResults ?? undefined),
      };
    });
  };
}
