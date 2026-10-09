import { tintClasses, type Tone } from '@goodboy/ui';
import type { RemoteTone } from '../../reviewRemote';
import type { ReviewCommentTone } from '../../reviewCommentState';

export const STATE_WORD_TONE: Record<ReviewCommentTone, string> = {
  new: 'text-muted-foreground',
  drafting: tintClasses('info').text,
  needs: tintClasses('warning').text,
  ready: tintClasses('warning').text,
  edited: tintClasses('warning').text,
  outdated: tintClasses('warning').text,
  failed: tintClasses('warning').text,
  push_failed: tintClasses('danger').text,
  accepted: tintClasses('success').text,
  replied: tintClasses('success').text,
  skipped: 'text-faint-foreground',
  pushed: 'text-muted-foreground',
  resolved: 'text-muted-foreground',
};

export const STATE_CHIP_TONE: Record<ReviewCommentTone, Tone> = {
  new: 'neutral',
  drafting: 'info',
  needs: 'warning',
  ready: 'warning',
  edited: 'warning',
  outdated: 'warning',
  failed: 'warning',
  push_failed: 'danger',
  accepted: 'success',
  replied: 'success',
  skipped: 'neutral',
  pushed: 'neutral',
  resolved: 'neutral',
};

export const REMOTE_TONE_CLASS: Record<RemoteTone, string> = {
  success: tintClasses('success').text,
  warning: tintClasses('warning').text,
  info: tintClasses('info').text,
  muted: 'text-muted-foreground',
};
