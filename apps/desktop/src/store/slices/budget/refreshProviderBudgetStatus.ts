import { loadCurrentProviderBudgetStatuses } from './loadProviderBudgetStatuses';
import type { SetFn } from './types';

export const refreshProviderBudgetStatus = (set: SetFn) => {
  return async () => {
    set({ providerBudgetStatus: await loadCurrentProviderBudgetStatuses() });
  };
};
