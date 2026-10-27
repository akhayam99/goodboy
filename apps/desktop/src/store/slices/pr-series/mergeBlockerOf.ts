import type { PullRequestView } from '@goodboy/types';

type Params = {
  readonly view: PullRequestView;
};

const FAILED: ReadonlySet<string> = new Set([
  'failure',
  'timed_out',
  'cancelled',
  'action_required',
]);

export const mergeBlockerOf = ({ view }: Params): string | null => {
  if (view.state === 'closed') {
    return 'is closed';
  }
  if (view.isDraft || view.state === 'draft') {
    return 'is still a draft';
  }
  if (view.mergeable === false) {
    return 'has conflicts';
  }
  if (view.reviewDecision === 'changes_requested') {
    return 'has changes requested';
  }
  if (view.checks.runs.some((run) => FAILED.has(run.conclusion))) {
    return 'has failing checks';
  }
  if (view.checks.runs.some((run) => run.conclusion === 'pending')) {
    return 'has checks still running';
  }
  return null;
};
