import { tintClasses } from '@goodboy/ui';
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
