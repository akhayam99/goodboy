import { tintClasses } from '@goodboy/ui';
import type { RemoteTone } from '../../reviewRemote';
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

export const REMOTE_TONE_CLASS: Record<RemoteTone, string> = {
  success: tintClasses('success').text,
  warning: tintClasses('warning').text,
  info: tintClasses('info').text,
  muted: 'text-muted-foreground',
};
