import {
  CircleCheck,
  CircleDashed,
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
  GitPullRequestDraft,
  ListChecks,
  type LucideIcon,
} from 'lucide-react';
import type { PullRequestStateKind } from '@goodboy/types';
import type { Tone } from '@goodboy/ui';

export type PullRequestPresentationState = PullRequestStateKind | 'none';

export type PullRequestPresentation = {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly textClass: string;
  readonly tone: Tone;
};

export const PULL_REQUEST_PRESENTATION = {
  none: {
    icon: CircleDashed,
    label: 'No pull request',
    textClass: 'text-muted-foreground/50',
    tone: 'neutral',
  },
  draft: {
    icon: GitPullRequestDraft,
    label: 'Draft',
    textClass: 'text-muted-foreground',
    tone: 'neutral',
  },
  open: {
    icon: GitPullRequest,
    label: 'In review',
    textClass: 'text-success',
    tone: 'success',
  },
  approved: {
    icon: CircleCheck,
    label: 'Approved',
    textClass: 'text-success',
    tone: 'success',
  },
  queued: {
    icon: ListChecks,
    label: 'Queued',
    textClass: 'text-primary',
    tone: 'primary',
  },
  merged: {
    icon: GitMerge,
    label: 'Merged',
    textClass: 'text-merged',
    tone: 'merged',
  },
  closed: {
    icon: GitPullRequestClosed,
    label: 'Closed',
    textClass: 'text-danger',
    tone: 'danger',
  },
} satisfies Record<PullRequestPresentationState, PullRequestPresentation>;
