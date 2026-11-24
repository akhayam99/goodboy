import type { ActivityRowTone } from '@goodboy/ui';

export const ACTIVITY_STATE_WORD_TONE: Record<ActivityRowTone, string | null> = {
  quiet: null,
  live: null,
  attention: 'text-warning',
  failed: 'text-danger',
  pending: 'text-faint-foreground',
};
