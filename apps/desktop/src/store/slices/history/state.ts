import type { AgentId, MountId } from '@goodboy/types';
import type {
  BranchPushFix,
  HistoryDraft,
  HistoryLiveSession,
  HistoryRewriterBinding,
  HistoryRun,
} from './types';

export type HistoryState = {
  readonly historyRuns: Readonly<Record<MountId, HistoryRun>>;
  readonly historyRewriters: Readonly<Record<AgentId, HistoryRewriterBinding>>;
  readonly historyDrafts: Readonly<Record<MountId, HistoryDraft>>;
  readonly branchPushFixes: Readonly<Record<AgentId, BranchPushFix>>;
  readonly settledBranchPushes: Readonly<Record<MountId, number>>;
  readonly historyLiveSessions: Readonly<Record<MountId, HistoryLiveSession>>;
};

export const historyInitialState: HistoryState = {
  historyRuns: {},
  historyRewriters: {},
  historyDrafts: {},
  branchPushFixes: {},
  settledBranchPushes: {},
  historyLiveSessions: {},
};
