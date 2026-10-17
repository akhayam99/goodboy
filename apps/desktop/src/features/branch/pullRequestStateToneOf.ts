import {
  GitBranch,
  GitMerge,
  GitPullRequest,
  GitPullRequestArrow,
  GitPullRequestClosed,
  GitPullRequestDraft,
  type LucideIcon,
} from 'lucide-react';
import { tintClasses, type Tone } from '@goodboy/ui';
import type { PullRequestPresentationState } from '../../shared/pullRequestPresentation';

type Params = {
  readonly state: PullRequestPresentationState;
};

export type PullRequestStateTone = {
  readonly icon: LucideIcon;
  readonly tone: Tone;
  readonly iconClass: string;
};

type StateMark = {
  readonly icon: LucideIcon;
  readonly tone: Tone;
};

const STATE_MARK: Readonly<Record<PullRequestPresentationState, StateMark>> = {
  none: { icon: GitBranch, tone: 'neutral' },
  draft: { icon: GitPullRequestDraft, tone: 'neutral' },
  open: { icon: GitPullRequest, tone: 'success' },
  approved: { icon: GitPullRequest, tone: 'success' },
  queued: { icon: GitPullRequestArrow, tone: 'warning' },
  merged: { icon: GitMerge, tone: 'merged' },
  closed: { icon: GitPullRequestClosed, tone: 'danger' },
};

export const pullRequestStateToneOf = ({ state }: Params): PullRequestStateTone => {
  const mark = STATE_MARK[state];
  return {
    icon: mark.icon,
    tone: mark.tone,
    iconClass: state === 'none' ? '' : tintClasses(mark.tone).icon,
  };
};
