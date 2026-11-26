import type { ButtonIntent } from '@goodboy/ui';
import { isStopVerb } from './isStopVerb';

type Params = {
  readonly verb: string;
};

const CAUTION_VERBS: ReadonlySet<string> = new Set([
  'diff.rebase',
  'mount.rebase',
  'session.rebaseAll',
  'diff.rewriteHistory',
  'mount.rewriteHistory',
  'rebase',
  'rebase all',
  'force push',
  'reset',
  'abort rebase',
  'undo rebase',
  'retry rebase',
  'rebase on their commits',
  'diff.abortRebase',
  'mount.abortRebase',
  'mount.abortRebaseConflict',
  'session.abortRebaseAll',
  'commit.squashDown',
  'commit.foldDown',
]);

const DESTRUCTIVE_VERBS: ReadonlySet<string> = new Set([
  'diff.removeWorktree',
  'worktree.remove',
  'mount.cleanUp',
  'mount.removeGone',
  'mount.forget',
  'branch.delete',
  'project.detach',
  'artifact.deletePermanently',
  'workflowRun.discard',
  'writeReview.discard',
  'planComments.discard',
  'projectAsk.discard',
  'port.forceStop',
  'remove worktree',
  'remove worktrees',
  'delete branch',
  'discard',
  'discard changes',
  'discard draft',
  'archive and remove',
  'delete all data',
  'clear site data',
  'clear browser data',
]);

const PRIMARY_VERBS: ReadonlySet<string> = new Set([
  'diff.push',
  'mount.push',
  'review.push',
  'diff.createPullRequest',
  'mount.createPullRequest',
  'pullRequest.create',
  'pullRequest.merge',
  'session.review',
  'session.startRun',
  'record.launch',
  'workflowRun.continue',
  'diff.continueRebase',
  'push',
  'open pr',
  'open pull request',
  'create pr',
  'create pull request',
  'merge',
  'review',
  'run',
  'run all',
  'continue',
]);

export const actionIntentOf = ({ verb }: Params): ButtonIntent => {
  if (
    isStopVerb({ verb }) ||
    DESTRUCTIVE_VERBS.has(verb) ||
    DESTRUCTIVE_VERBS.has(verb.toLowerCase()) ||
    verb.endsWith('.delete') ||
    verb.endsWith('.discard') ||
    verb === 'commit.remove'
  ) {
    return 'destructive';
  }
  if (CAUTION_VERBS.has(verb) || CAUTION_VERBS.has(verb.toLowerCase())) {
    return 'caution';
  }
  if (PRIMARY_VERBS.has(verb) || PRIMARY_VERBS.has(verb.toLowerCase())) {
    return 'primary';
  }
  return 'neutral';
};
