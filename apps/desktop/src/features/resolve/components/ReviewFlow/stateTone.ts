import { tintClasses, type Tone } from '@goodboy/ui';
import type { ThreadRemoteKind } from '../../../../store/slices/resolve/threadGitState';
import type { ReviewCommentState } from '../../reviewCommentState';

export const STATE_WORD_TONE: Record<ReviewCommentState, string> = {
  new: 'text-muted-foreground',
  drafting: tintClasses('info').text,
  needs: tintClasses('warning').text,
  ready: 'text-muted-foreground',
  edited: tintClasses('draft').text,
  outdated: tintClasses('primary').text,
  failed: tintClasses('danger').text,
  accepted: tintClasses('success').text,
  replied: tintClasses('success').text,
  skipped: 'text-muted-foreground',
  pushed: tintClasses('success').text,
  resolved: 'text-muted-foreground',
};

export const STATE_CHIP_TONE: Record<ReviewCommentState, Tone> = {
  new: 'neutral',
  drafting: 'info',
  needs: 'warning',
  ready: 'warning',
  edited: 'warning',
  outdated: 'warning',
  failed: 'danger',
  accepted: 'success',
  replied: 'success',
  skipped: 'neutral',
  pushed: 'success',
  resolved: 'neutral',
};

export const REMOTE_WORD_TONE: Record<ThreadRemoteKind, string> = {
  on_origin: tintClasses('success').text,
  looks_fixed: tintClasses('success').text,
  you_replied: tintClasses('success').text,
  missing: tintClasses('warning').text,
};
