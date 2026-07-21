import type { ReactNode } from 'react';
import { cn } from '@goodboy/ui';

type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'muted';

type Props = {
  readonly tone: Tone;
  readonly label: string;
  readonly mono?: boolean;
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

const TONE_BORDER: Record<Tone, string> = {
  primary: 'border-primary/20',
  success: 'border-success/20',
  warning: 'border-warning/20',
  danger: 'border-danger/20',
  info: 'border-info/20',
  muted: 'border-border-soft',
};

export const Tile = ({ tone, label, mono, children }: Props) => (
  <div
    className={cn(
      'flex flex-col gap-1.5 rounded-lg border p-3.5',
      TONE_BG[tone],
      TONE_BORDER[tone],
    )}
  >
    <span className={cn('text-xs font-semibold uppercase tracking-wide', TONE_FG[tone])}>
      {label}
    </span>
    <span className={cn('text-xs leading-relaxed text-muted-foreground', mono && 'font-mono')}>
      {children}
    </span>
  </div>
);
