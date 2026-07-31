import type { EffortLevel, VerbosityLevel } from '@goodboy/types';

export type ChipTone = 'neutral' | 'light' | 'moderate' | 'heavy' | 'peak';

export const CHIP_TONE_ACTIVE: Record<ChipTone, string> = {
  neutral: 'bg-background text-foreground ring-1 ring-inset ring-border-soft',
  light: 'bg-success/15 text-success ring-1 ring-inset ring-success/40',
  moderate: 'bg-info/15 text-info ring-1 ring-inset ring-info/40',
  heavy: 'bg-warning/15 text-warning ring-1 ring-inset ring-warning/40',
  peak: 'bg-danger/15 text-danger ring-1 ring-inset ring-danger/40',
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
