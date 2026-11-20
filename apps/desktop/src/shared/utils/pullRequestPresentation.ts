import {
  CircleCheck,
  CircleDashed,
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
  GitPullRequestDraft,
  ListChecks,
} from '@goodboy/ui/icons';
import type { PullRequestStateKind } from '@goodboy/types';
import type { StatePresentation } from './statePresentation';
import { NAMES } from './names';

export type PullRequestPresentationState = PullRequestStateKind | 'none';

export type PullRequestPresentation = StatePresentation & {
  readonly textClass: string;
};

export const PULL_REQUEST_PRESENTATION = {
  none: {
    icon: CircleDashed,
    label: 'No pull request',
    reason: 'nothing has been opened yet',
    textClass: 'text-faint-foreground',
    tone: 'neutral',
  },
  draft: {
    icon: GitPullRequestDraft,
    label: 'Draft',
    reason: 'open, but not ready for review',
    textClass: 'text-muted-foreground',
    tone: 'neutral',
  },
  open: {
    icon: GitPullRequest,
    label: 'Open',
    reason: 'waiting for a reviewer',
    textClass: 'text-info',
    tone: 'info',
  },
  approved: {
    icon: CircleCheck,
    label: 'Approved',
    reason: 'reviewed and ready to merge',
    textClass: 'text-success',
    tone: 'success',
  },
  queued: {
    icon: ListChecks,
    label: NAMES.inMergeQueue,
    reason: 'waiting in the merge queue',
    textClass: 'text-muted-foreground',
    tone: 'neutral',
  },
  merged: {
    icon: GitMerge,
    label: 'Merged',
    reason: 'integrated into the base branch',
    textClass: 'text-merged',
    tone: 'merged',
  },
  closed: {
    icon: GitPullRequestClosed,
    label: 'Closed',
    reason: 'closed without being merged',
    textClass: 'text-muted-foreground',
    tone: 'neutral',
  },
} satisfies Record<PullRequestPresentationState, PullRequestPresentation>;
