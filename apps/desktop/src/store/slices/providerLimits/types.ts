import type { ProviderLimits } from '@goodboy/types';
import type { ProviderLimitsState } from './state';

export type { GetFn, SetFn } from '../../slice-types';

export type RecordProviderLimitsParams = {
  readonly limits: ProviderLimits;
};

export type RefreshCodexLimitsParams = {
  readonly withResetDetails?: boolean;
};

export type CodexResetResult = 'reset' | 'nothingToReset' | 'noCredit' | 'failed';

export type ProviderLimitsSlice = ProviderLimitsState & {
  loadProviderLimits(): Promise<void>;
  recordProviderLimits(params: RecordProviderLimitsParams): Promise<void>;
  refreshCodexLimits(params?: RefreshCodexLimitsParams): Promise<void>;
  refreshClaudeUsage(): Promise<void>;
  probeProviderLimits(): Promise<void>;
  consumeCodexResetCredit(): Promise<CodexResetResult>;
};
