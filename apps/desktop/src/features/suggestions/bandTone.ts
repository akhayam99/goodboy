import type { Tone } from '@goodboy/ui';
import type { NextStepBand } from './types';

export const BAND_TONE: Record<NextStepBand, Tone> = {
  0: 'warning',
  1: 'info',
  2: 'primary',
  3: 'neutral',
};
