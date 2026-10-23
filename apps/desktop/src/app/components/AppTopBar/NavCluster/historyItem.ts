import type { HistoryLabel } from './historyLabel';

export type HistoryItem = HistoryLabel & {
  readonly index: number;
  readonly isCurrent: boolean;
};
