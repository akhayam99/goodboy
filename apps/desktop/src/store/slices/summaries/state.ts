import type { IsoDateTime } from '@goodboy/types';

export type SummarizerSessionStatus = {
  readonly status: 'idle' | 'running' | 'error';
  readonly lastUpdate: IsoDateTime | null;
  readonly error: string | null;
  readonly lastUsage: {
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly estimatedCostUsd: number;
  } | null;
  readonly lastAttempt: {
    readonly turnInput: string;
    readonly turnOutput: string;
    readonly workingDir: string | null;
  } | null;
};

export type SummariesState = {
  readonly summarizerStatus: Readonly<Record<string, SummarizerSessionStatus>>;
};

export const summariesInitialState: SummariesState = {
  summarizerStatus: {},
};
