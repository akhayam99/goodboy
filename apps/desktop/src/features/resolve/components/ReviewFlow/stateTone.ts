import { tintClasses, type Tone } from '@goodboy/ui';
import type { RemoteTone } from '../../reviewRemote';
import type { ReviewCommentTone } from '../../reviewCommentState';

const MUTED = 'text-muted-foreground';

export const STATE_WORD_TONE: Record<ReviewCommentTone, string> = {
  new: MUTED,
  drafting: MUTED,
  needs: MUTED,
  ready: MUTED,
  edited: MUTED,
  outdated: MUTED,
  failed: MUTED,
  push_failed: MUTED,
  accepted: MUTED,
  replied: MUTED,
  skipped: 'text-faint-foreground',
  pushed: MUTED,
  resolved: MUTED,
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
