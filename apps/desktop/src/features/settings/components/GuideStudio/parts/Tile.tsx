import type { ReactNode } from 'react';
import { cn, tintClasses, type Tone as SharedTone } from '@goodboy/ui';

type Tone = Extract<SharedTone, 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'>;

type Props = {
  readonly tone: Tone;
  readonly label: string;
  readonly mono?: boolean;
  readonly children: ReactNode;
};

export const Tile = ({ tone, label, mono, children }: Props) => (
  <div
    className={cn(
      'flex flex-col gap-1.5 rounded-lg border p-3.5',
      tintClasses(tone).bg,
      tintClasses(tone).borderSoft,
    )}
  >
    <span className={cn('text-xs font-semibold uppercase tracking-wide', tintClasses(tone).text)}>
      {label}
    </span>
    <span className={cn('text-xs leading-relaxed text-muted-foreground', mono && 'font-mono')}>
      {children}
    </span>
  </div>
);
