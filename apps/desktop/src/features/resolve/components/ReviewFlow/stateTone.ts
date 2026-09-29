import { tintClasses, type Tone } from '@goodboy/ui';
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
