import type { ProviderRunId } from '@goodboy/types';

export type RetryRunParams = {
  readonly runId: ProviderRunId;
  readonly model: string | null;
};
