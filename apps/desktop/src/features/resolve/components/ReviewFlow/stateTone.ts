import { tintClasses } from '@goodboy/ui';
import type { ThreadRemoteKind } from '../../../../store/slices/resolve/threadGitState';
import type { ReviewCommentState } from '../../reviewCommentState';

export const STATE_WORD_TONE: Record<ReviewCommentState, string> = {
  new: 'text-muted-foreground',
  drafting: tintClasses('info').text,
  needs: tintClasses('warning').text,
  ready: tintClasses('warning').text,
  edited: tintClasses('warning').text,
  outdated: tintClasses('warning').text,
  failed: tintClasses('danger').text,
  accepted: tintClasses('success').text,
  replied: tintClasses('success').text,
  skipped: 'text-muted-foreground',
  pushed: tintClasses('success').text,
  resolved: 'text-muted-foreground',
};

export const REMOTE_WORD_TONE: Record<ThreadRemoteKind, string> = {
  on_origin: tintClasses('success').text,
  looks_fixed: tintClasses('success').text,
  you_replied: tintClasses('success').text,
  missing: tintClasses('warning').text,
};
