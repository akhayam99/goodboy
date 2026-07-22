import type { ReactNode } from 'react';
import { cn } from '@goodboy/ui';

type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'muted';

type Props = {
  readonly tone: Tone;
  readonly children: ReactNode;
};

const TONE_BG: Record<Tone, string> = {
  primary: 'bg-primary/10',
  success: 'bg-success/10',
  warning: 'bg-warning/10',
  danger: 'bg-danger/10',
  info: 'bg-info/10',
  muted: 'bg-muted',
};

const TONE_FG: Record<Tone, string> = {
  primary: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-info',
  muted: 'text-muted-foreground',
};

export const Chip = ({ tone, children }: Props) => (
  <span
    className={cn(
      'inline-flex items-center rounded-md px-2 py-0.5 text-2xs font-medium',
      TONE_BG[tone],
      TONE_FG[tone],
    )}
  >
    {children}
  </span>
);
