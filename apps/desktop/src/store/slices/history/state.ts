import type { AgentId, MountId } from '@goodboy/types';
import type {
  BranchPushFix,
  HistoryDraft,
  HistoryLiveSession,
  HistoryRewriterBinding,
  HistoryRun,
  PushContinuation,
  PushFixOutcome,
} from './types';
import { readPushFixMemory } from './pushFix/pushFixMemory';

export type HistoryState = {
  readonly historyRuns: Readonly<Record<MountId, HistoryRun>>;
  readonly historyRewriters: Readonly<Record<AgentId, HistoryRewriterBinding>>;
  readonly historyDrafts: Readonly<Record<MountId, HistoryDraft>>;
  readonly branchPushFixes: Readonly<Record<AgentId, BranchPushFix>>;
  readonly settledBranchPushes: Readonly<Record<MountId, number>>;
  readonly pushContinuations: Readonly<Record<MountId, PushContinuation>>;
  readonly pushFixOutcomes: Readonly<Record<MountId, PushFixOutcome>>;
  readonly pushFixClaims: Readonly<Record<MountId, AgentId>>;
  readonly historyLiveSessions: Readonly<Record<MountId, HistoryLiveSession>>;
};

const remembered = readPushFixMemory();

export const historyInitialState: HistoryState = {
  historyRuns: {},
  historyRewriters: {},
  historyDrafts: {},
  branchPushFixes: remembered.fixes,
  settledBranchPushes: {},
  pushContinuations: {},
  pushFixOutcomes: remembered.outcomes,
  pushFixClaims: {},
  historyLiveSessions: {},
};
