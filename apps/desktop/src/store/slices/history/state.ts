import type { AgentId, MountId } from '@goodboy/types';
import type { HistoryRewriterBinding, HistoryRun } from './types';

export type HistoryState = {
  readonly historyRuns: Readonly<Record<MountId, HistoryRun>>;
  readonly historyRewriters: Readonly<Record<AgentId, HistoryRewriterBinding>>;
};

export const historyInitialState: HistoryState = {
  historyRuns: {},
  historyRewriters: {},
};
