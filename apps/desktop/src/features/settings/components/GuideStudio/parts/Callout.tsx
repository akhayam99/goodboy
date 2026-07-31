import type { ReactNode } from 'react';
import { cn, tintClasses, type Tone as SharedTone } from '@goodboy/ui';

type Tone = Extract<SharedTone, 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'>;

type Props = {
  readonly tone: Tone;
  readonly icon: ReactNode;
  readonly children: ReactNode;
};

export const Callout = ({ tone, icon, children }: Props) => (
  <div
    className={cn(
      'flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm leading-relaxed text-muted-foreground',
      tintClasses(tone).bg,
      tintClasses(tone).borderSoft,
    )}
  >
    <span className={cn('mt-0.5 shrink-0', tintClasses(tone).text)}>{icon}</span>
    <div>{children}</div>
  </div>
);
