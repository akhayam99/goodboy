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
import type { PullRequestPresentationState } from '../../shared/utils/pullRequestPresentation';

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
  open: { icon: GitPullRequest, tone: 'info' },
  approved: { icon: GitPullRequest, tone: 'success' },
  queued: { icon: GitPullRequestArrow, tone: 'primary' },
  merged: { icon: GitMerge, tone: 'merged' },
  closed: { icon: GitPullRequestClosed, tone: 'neutral' },
};

export const pullRequestStateToneOf = ({ state }: Params): PullRequestStateTone => {
  const mark = STATE_MARK[state];
  return {
    icon: mark.icon,
    tone: mark.tone,
    iconClass: state === 'none' ? '' : tintClasses(mark.tone).icon,
  };
};
