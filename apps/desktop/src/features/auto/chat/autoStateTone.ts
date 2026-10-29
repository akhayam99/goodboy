import type { Tone } from '@goodboy/ui';

export type AutoMeaning = 'waitingOnYou' | 'artifact' | 'running' | 'done' | 'failed' | 'idle';

export const AUTO_STATE_TONE = {
  waitingOnYou: 'warning',
  artifact: 'merged',
  running: 'info',
  done: 'success',
  failed: 'danger',
  idle: 'neutral',
} as const satisfies Record<AutoMeaning, Tone>;
