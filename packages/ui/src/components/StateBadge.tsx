import type { ReactNode } from 'react';
import { cn } from '../cn';
import { tintClasses, type Tone } from '../tint';

type StateTone = Extract<Tone, 'neutral' | 'success' | 'danger' | 'info' | 'warning'>;

type Props = {
  readonly tone?: StateTone;
  readonly children: ReactNode;
};

export const StateBadge = ({ tone = 'neutral', children }: Props) => {
  const t = tintClasses(tone);
  return (
    <span className={cn('rounded px-1.5 py-0.5 text-2xs font-medium', t.bg, t.text)}>
      {children}
    </span>
  );
};

export type { StateTone };
