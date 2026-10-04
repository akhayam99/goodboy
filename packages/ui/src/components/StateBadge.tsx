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
  return <span className={cn('rounded-sm px-2 py-0.5 text-chip', t.bg, t.text)}>{children}</span>;
};

export type { StateTone };
