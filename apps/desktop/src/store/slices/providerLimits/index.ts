import { consumeCodexResetCredit } from './consumeCodexResetCredit';
import { loadProviderLimits } from './loadProviderLimits';
import { probeProviderLimits } from './probeProviderLimits';
import { recordProviderLimits } from './recordProviderLimits';
import { refreshClaudeUsage } from './refreshClaudeUsage';
import { refreshCodexLimits } from './refreshCodexLimits';
import { providerLimitsInitialState } from './state';
import type { GetFn, ProviderLimitsSlice, SetFn } from './types';

export const createProviderLimitsSlice = (set: SetFn, get: GetFn): ProviderLimitsSlice => ({
  ...providerLimitsInitialState,
  loadProviderLimits: loadProviderLimits(set),
  recordProviderLimits: recordProviderLimits(set, get),
  refreshCodexLimits: refreshCodexLimits(set, get),
  refreshClaudeUsage: refreshClaudeUsage(set, get),
  probeProviderLimits: probeProviderLimits(get),
  consumeCodexResetCredit: consumeCodexResetCredit(set, get),
});
