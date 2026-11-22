import type { SessionWorktree, WorkEvent } from '@goodboy/db';
import type { SessionExternalTask } from '@goodboy/types';

export type TimelineIssueEntry = {
  readonly kind: 'issue';
  readonly id: string;
  readonly at: string;
  readonly task: SessionExternalTask;
};

export type TimelineBranchEntry = {
  readonly kind: 'branch';
  readonly id: string;
  readonly at: string;
  readonly worktree: SessionWorktree;
};

export type TimelineWorkEntry = {
  readonly kind: 'work';
  readonly id: string;
  readonly at: string;
  readonly work: WorkEvent;
  readonly mountName: string | null;
};
