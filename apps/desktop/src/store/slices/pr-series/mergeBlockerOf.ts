import type { PullRequestView } from '@goodboy/types';

type Params = {
  readonly view: PullRequestView;
};

export type MergeBlockerKind =
  'closed' | 'draft' | 'conflict' | 'changes-requested' | 'failing' | 'pending';

export type MergeBlocker = Readonly<{
  kind: MergeBlockerKind;
  text: string;
}>;

const FAILED: ReadonlySet<string> = new Set([
  'failure',
  'timed_out',
  'cancelled',
  'action_required',
]);

export const mergeBlockerOf = ({ view }: Params): MergeBlocker | null => {
  if (view.state === 'closed') {
    return { kind: 'closed', text: 'is closed' };
  }
  if (view.isDraft || view.state === 'draft') {
    return { kind: 'draft', text: 'is still a draft' };
  }
  if (view.mergeable === false) {
    return { kind: 'conflict', text: 'has conflicts' };
  }
  if (view.reviewDecision === 'changes_requested') {
    return { kind: 'changes-requested', text: 'has changes requested' };
  }
  if (view.checks.runs.some((run) => FAILED.has(run.conclusion))) {
    return { kind: 'failing', text: 'has failing checks' };
  }
  if (view.checks.runs.some((run) => run.conclusion === 'pending')) {
    return { kind: 'pending', text: 'has checks still running' };
  }
  return null;
};
