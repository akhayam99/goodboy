import {
  CircleCheck,
  CircleDashed,
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
  GitPullRequestDraft,
  ListChecks,
} from 'lucide-react';
import type { PullRequestStateKind, SessionPrGroup } from '@goodboy/types';
import type { StatePresentation } from './utils/statePresentation';

export type PullRequestPresentationState = PullRequestStateKind | 'none';

export type PullRequestPresentation = StatePresentation & {
  readonly textClass: string;
};

export const PULL_REQUEST_PRESENTATION = {
  none: {
    icon: CircleDashed,
    label: 'No pull request',
    reason: 'nothing has been opened yet',
    textClass: 'text-muted-foreground/50',
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
    label: 'In review',
    reason: 'waiting for a reviewer',
    textClass: 'text-success',
    tone: 'success',
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
    label: 'Queued',
    reason: 'waiting in the merge queue',
    textClass: 'text-primary',
    tone: 'primary',
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
    textClass: 'text-danger',
    tone: 'danger',
  },
} satisfies Record<PullRequestPresentationState, PullRequestPresentation>;

export const PR_GROUP_PRESENTATION = {
  'not-open': { ...PULL_REQUEST_PRESENTATION.none, label: 'no PR' },
  draft: { ...PULL_REQUEST_PRESENTATION.draft, label: 'draft' },
  reviewable: { ...PULL_REQUEST_PRESENTATION.open, label: 'in review' },
  reviewed: { ...PULL_REQUEST_PRESENTATION.approved, label: 'approved' },
  queued: { ...PULL_REQUEST_PRESENTATION.queued, label: 'queued' },
  closed: { ...PULL_REQUEST_PRESENTATION.closed, label: 'closed' },
  merged: { ...PULL_REQUEST_PRESENTATION.merged, label: 'merged' },
} satisfies Record<SessionPrGroup, PullRequestPresentation>;
