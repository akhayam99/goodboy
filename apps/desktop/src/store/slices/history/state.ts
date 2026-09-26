import type { AgentId, MountId } from '@goodboy/types';
import type { HistoryDraft, HistoryRewriterBinding, HistoryRun } from './types';

export type HistoryState = {
  readonly historyRuns: Readonly<Record<MountId, HistoryRun>>;
  readonly historyRewriters: Readonly<Record<AgentId, HistoryRewriterBinding>>;
  readonly historyDrafts: Readonly<Record<MountId, HistoryDraft>>;
};

export const historyInitialState: HistoryState = {
  historyRuns: {},
  historyRewriters: {},
  historyDrafts: {},
};
