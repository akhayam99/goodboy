import type { ProviderLimits } from '@goodboy/types';
import type { ProviderLimitsState } from './state';

export type { GetFn, SetFn } from '../../slice-types';

export type RecordProviderLimitsParams = {
  readonly limits: ProviderLimits;
};

export type ProviderLimitsSlice = ProviderLimitsState & {
  loadProviderLimits(): Promise<void>;
  recordProviderLimits(params: RecordProviderLimitsParams): Promise<void>;
  refreshCodexLimits(): Promise<void>;
  refreshClaudeUsage(): Promise<void>;
  probeProviderLimits(): Promise<void>;
};
