import type { ReactNode } from 'react';
import { cn, StatCard, Tooltip } from '@goodboy/ui';
import { CoachingLine } from './CoachingLine';

type Props = {
  readonly label: string;
  readonly measure: string;
  readonly value: string;
  readonly hint?: string;
  readonly coaching?: string | null;
  readonly children?: ReactNode;
  readonly className?: string;
};

export const MetricCard = ({
  label,
  measure,
  value,
  hint,
  coaching,
  children,
  className,
}: Props) => (
  <div
    className={cn(
      'flex flex-col gap-2 rounded-lg border bg-muted/20 px-4 py-3',
      coaching != null ? 'border-warning/40' : 'border-border-soft',
      className,
    )}
  >
    <Tooltip content={measure} side="top">
      <div>
        <StatCard
          label={label}
          value={value}
          hint={hint}
          className="border-transparent bg-transparent px-0 py-0"
        />
      </div>
    </Tooltip>
    {children}
    {coaching != null ? <CoachingLine message={coaching} /> : null}
  </div>
);
