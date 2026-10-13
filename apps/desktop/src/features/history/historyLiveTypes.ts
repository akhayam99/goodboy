import type { HistoryMoveOutcome, HistoryShaMove, HistoryTrialResult } from '@goodboy/types';

export type HistoryLiveOutcome =
  | { readonly kind: 'blocked'; readonly reason: string }
  | { readonly kind: 'stopped'; readonly result: HistoryTrialResult }
  | {
      readonly kind: 'finished';
      readonly outcome: HistoryMoveOutcome;
      readonly map: ReadonlyArray<HistoryShaMove>;
    };
