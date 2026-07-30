import type { ReactNode } from 'react';
import { cn } from '@goodboy/ui';

type StateTone = 'neutral' | 'success' | 'danger' | 'info' | 'warning';

const TONE_CLASS: Record<StateTone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  success: 'bg-success/15 text-success',
  danger: 'bg-danger/15 text-danger',
  info: 'bg-info/15 text-info',
  warning: 'bg-warning/15 text-warning',
};

type Props = {
  readonly tone?: StateTone;
  readonly children: ReactNode;
};

export const IssueStateBadge = ({ tone = 'neutral', children }: Props) => {
  return (
    <span className={cn('rounded px-1.5 py-0.5 text-2xs font-medium', TONE_CLASS[tone])}>
      {children}
    </span>
  );
};

export type { StateTone };
