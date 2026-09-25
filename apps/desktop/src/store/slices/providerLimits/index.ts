import { loadProviderLimits } from './loadProviderLimits';
import { recordProviderLimits } from './recordProviderLimits';
import { refreshCodexLimits } from './refreshCodexLimits';
import { providerLimitsInitialState } from './state';
import type { GetFn, ProviderLimitsSlice, SetFn } from './types';

export const createProviderLimitsSlice = (set: SetFn, get: GetFn): ProviderLimitsSlice => ({
  ...providerLimitsInitialState,
  loadProviderLimits: loadProviderLimits(set),
  recordProviderLimits: recordProviderLimits(set, get),
  refreshCodexLimits: refreshCodexLimits(get),
});
