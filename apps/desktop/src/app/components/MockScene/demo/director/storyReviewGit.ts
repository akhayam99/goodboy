import type { MountId, SessionId, WorktreeStatus } from '@goodboy/types';
import type { HistoryRun } from '../../../../../store/slices/history/types';
import { GUARD_BRANCH } from './autoStory';

export type StoryGitPhase = 'behind' | 'rebased' | 'pushed';

type StatusParams = {
  readonly phase: StoryGitPhase;
};

const HEAD = 'a41c9e2b7d3';
const REBASED_HEAD = 'c7d20f4e915';
const BACKUP_REF = 'refs/goodboy/backup/hl-fix-duplicate-credit/1';

export const storyStatusOf = ({ phase }: StatusParams): WorktreeStatus => ({
  branch: GUARD_BRANCH,
  head: phase === 'behind' ? HEAD : REBASED_HEAD,
  headSubject: 'Return the original credit for a repeated webhook',
  upstream: `origin/${GUARD_BRANCH}`,
  upstreamDistance:
    phase === 'rebased'
      ? { kind: 'known', ahead: 2, behind: 2 }
      : { kind: 'known', ahead: 0, behind: 0 },
  mainDistance: { kind: 'known', ahead: 2, behind: phase === 'behind' ? 3 : 0 },
  workingTree: { kind: 'known', staged: 0, unstaged: 0, untracked: 0, unmerged: 0, changed: 0 },
  inProgress: null,
});

type RunParams = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
};

export const storyRebasedRunOf = ({ sessionId, mountId }: RunParams): HistoryRun => ({
  sessionId,
  mountId,
  origin: 'rebase',
  phase: 'applied',
  planId: null,
  agentId: null,
  copyPath: null,
  stop: null,
  result: null,
  backupRef: BACKUP_REF,
  remoteSha: HEAD,
  holder: null,
  progress: null,
  applied: null,
  identity: null,
  movedHead: REBASED_HEAD,
  threadShas: [],
  commitCount: 2,
  carriedCount: 0,
  updatedAt: Date.now(),
});
