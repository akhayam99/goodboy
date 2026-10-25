import { describe, expect, it } from 'vitest';
import {
  GitBranch,
  GitMerge,
  GitPullRequest,
  GitPullRequestArrow,
  GitPullRequestClosed,
  GitPullRequestDraft,
} from 'lucide-react';
import type { PullRequestPresentationState } from '../../shared/utils/pullRequestPresentation';
import { pullRequestStateToneOf } from './pullRequestStateToneOf';

const CASES: ReadonlyArray<{
  readonly state: PullRequestPresentationState;
  readonly icon: unknown;
  readonly tone: string;
  readonly iconClass: string;
}> = [
  { state: 'none', icon: GitBranch, tone: 'neutral', iconClass: '' },
  {
    state: 'draft',
    icon: GitPullRequestDraft,
    tone: 'neutral',
    iconClass: 'text-muted-foreground',
  },
  { state: 'open', icon: GitPullRequest, tone: 'info', iconClass: 'text-info' },
  { state: 'approved', icon: GitPullRequest, tone: 'success', iconClass: 'text-success' },
  { state: 'queued', icon: GitPullRequestArrow, tone: 'primary', iconClass: 'text-primary' },
  { state: 'merged', icon: GitMerge, tone: 'merged', iconClass: 'text-merged' },
  {
    state: 'closed',
    icon: GitPullRequestClosed,
    tone: 'neutral',
    iconClass: 'text-muted-foreground',
  },
];

describe('pullRequestStateToneOf', () => {
  it.each(CASES)(
    'draws $state with its GitHub icon and tone',
    ({ state, icon, tone, iconClass }) => {
      const mark = pullRequestStateToneOf({ state });
      expect(mark.icon).toBe(icon);
      expect(mark.tone).toBe(tone);
      expect(mark.iconClass).toBe(iconClass);
    },
  );
});
