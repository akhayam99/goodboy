import type { EffortLevel, IsoDateTime, ProviderId } from '@goodboy/types';

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

export type SummarizerRound = {
  readonly finishedAt: IsoDateTime;
  readonly mode: 'turn' | 'consolidate';
  readonly turns: number;
  readonly provider: ProviderId;
  readonly model: string;
  readonly effort: EffortLevel | null;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly costUsd: number;
  readonly changed: {
    readonly goal: boolean;
    readonly decisions: number;
    readonly summary: boolean;
  };
};

export type SummarizerPending = {
  readonly turns: number;
  readonly isUpdateQueued: boolean;
};

export type SummariesState = {
  readonly summarizerStatus: Readonly<Record<string, SummarizerSessionStatus>>;
  readonly summarizerRounds: Readonly<Record<string, SummarizerRound>>;
  readonly summarizerPending: Readonly<Record<string, SummarizerPending>>;
};

export const summariesInitialState: SummariesState = {
  summarizerStatus: {},
  summarizerRounds: {},
  summarizerPending: {},
};
