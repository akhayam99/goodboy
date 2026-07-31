import type { ReactNode } from 'react';
import { cn, tintClasses, type Tone as SharedTone } from '@goodboy/ui';

type Tone = Extract<SharedTone, 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'>;

type Props = {
  readonly tone: Tone;
  readonly children: ReactNode;
};

export const Chip = ({ tone, children }: Props) => (
  <span
    className={cn(
      'inline-flex items-center rounded-md px-2 py-0.5 text-2xs font-medium',
      tintClasses(tone).bg,
      tintClasses(tone).text,
    )}
  >
    {children}
  </span>
);
