import type { EffortLevel, VerbosityLevel } from '@goodboy/types';
import { cn, tintClasses, type Tone } from '@goodboy/ui';

export type ChipTone = 'neutral' | 'light' | 'moderate' | 'heavy' | 'peak';

const CHIP_INTENSITY_TONE: Record<Exclude<ChipTone, 'neutral'>, Tone> = {
  light: 'success',
  moderate: 'info',
  heavy: 'warning',
  peak: 'danger',
};

const chipActiveClass = (tone: ChipTone): string => {
  if (tone === 'neutral') {
    return `bg-background text-foreground ring-1 ring-inset ${tintClasses('neutral').ring}`;
  }
  const t = tintClasses(CHIP_INTENSITY_TONE[tone]);
  return cn(t.bg, t.text, 'ring-1 ring-inset', t.ring);
};

export const CHIP_TONE_ACTIVE: Record<ChipTone, string> = {
  neutral: chipActiveClass('neutral'),
  light: chipActiveClass('light'),
  moderate: chipActiveClass('moderate'),
  heavy: chipActiveClass('heavy'),
  peak: chipActiveClass('peak'),
};

const EFFORT_TONE: Record<EffortLevel, ChipTone> = {
  minimal: 'light',
  low: 'light',
  medium: 'moderate',
  high: 'heavy',
  xhigh: 'peak',
  max: 'peak',
};

const VERBOSITY_TONE: Record<VerbosityLevel, ChipTone> = {
  brief: 'light',
  normal: 'moderate',
  verbose: 'heavy',
};

const TOGGLE_TONE: Record<'thinking' | 'fast', ChipTone> = {
  thinking: 'heavy',
  fast: 'light',
};

export const effortTone = (level: EffortLevel): ChipTone => EFFORT_TONE[level];

export const verbosityTone = (level: VerbosityLevel): ChipTone => VERBOSITY_TONE[level];

export const toggleTone = (id: 'thinking' | 'fast'): ChipTone => TOGGLE_TONE[id];
