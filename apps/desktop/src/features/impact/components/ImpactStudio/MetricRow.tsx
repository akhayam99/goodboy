import type { ReactNode } from 'react';
import { cn, Eyebrow, Tooltip } from '@goodboy/ui';
import { CoachingLine } from './CoachingLine';

type Props = {
  readonly label: string;
  readonly measure: string;
  readonly value: string;
  readonly hint?: string;
  readonly leading?: ReactNode;
  readonly coaching?: string | null;
  readonly children?: ReactNode;
};

export const MetricRow = ({ label, measure, value, hint, leading, coaching, children }: Props) => (
  <div
    className={cn(
      'flex flex-col gap-2 rounded-lg border bg-muted/20 px-4 py-3',
      coaching != null ? 'border-warning/40' : 'border-border-soft',
    )}
  >
    <div className="flex items-center gap-3">
      {leading}
      <Tooltip content={measure} side="top">
        <span className="min-w-0 flex-1">
          <Eyebrow label={label} />
        </span>
      </Tooltip>
      <span className="shrink-0 font-mono text-sm tabular-nums text-foreground">{value}</span>
    </div>
    {children}
    {hint != null ? <span className="text-2xs text-muted-foreground/70">{hint}</span> : null}
    {coaching != null ? <CoachingLine message={coaching} /> : null}
  </div>
);
