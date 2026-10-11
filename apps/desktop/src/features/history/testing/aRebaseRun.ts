import type { AgentId, MountId, SessionId } from '@goodboy/types';
import type { HistoryRun } from '../../../store/slices/history/types';
import { brandedId } from './brandedId';

export const A_REBASE_SESSION_ID = brandedId<SessionId>({ value: 'session-payments' });

export const A_REBASE_MOUNT_ID = brandedId<MountId>({ value: 'mount-payments' });

export const A_REBASE_AGENT_ID = brandedId<AgentId>({ value: 'agent-rewriter' });

export const aRebaseRun = (patch: Partial<HistoryRun> = {}): HistoryRun => ({
  sessionId: A_REBASE_SESSION_ID,
  mountId: A_REBASE_MOUNT_ID,
  origin: 'rebase',
  phase: 'predicting',
  planId: null,
  agentId: null,
  copyPath: null,
  stop: null,
  result: null,
  backupRef: null,
  remoteSha: null,
  holder: null,
  progress: null,
  applied: null,
  identity: null,
  movedHead: null,
  threadShas: [],
  commitCount: null,
  updatedAt: 0,
  ...patch,
});
