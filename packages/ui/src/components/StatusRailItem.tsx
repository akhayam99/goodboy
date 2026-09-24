import type { ReactNode } from 'react';
import { cn } from '../cn';
import type { Tone } from '../tint';
import { SelectableRow } from './SelectableRow';
import { StatusDot } from './StatusDot';

const DENSITY_CLASSES = {
  row: 'gap-2.5 px-2.5 py-2',
  compact: 'gap-2 py-1 pl-4 pr-2.5',
} as const satisfies Record<string, string>;

export type StatusRailItemProps = {
  readonly icon: ReactNode;
  readonly label: string;
  readonly subtitle?: string;
  readonly tone?: Tone;
  readonly statusLabel?: string;
  readonly selected: boolean;
  readonly density?: keyof typeof DENSITY_CLASSES;
  readonly className?: string;
  readonly onClick: () => void;
};

export const StatusRailItem = ({
  icon,
  label,
  subtitle,
  tone,
  statusLabel,
  selected,
  density = 'row',
  className,
  onClick,
}: StatusRailItemProps) => (
  <SelectableRow
    selected={selected}
    ariaCurrent={selected}
    onClick={onClick}
    className={cn('items-center', DENSITY_CLASSES[density], className)}
  >
    <span aria-hidden className="flex shrink-0 items-center">
      {icon}
    </span>
    <span className="flex min-w-0 flex-1 flex-col">
      <span className={cn('truncate text-sm', density === 'row' && 'font-medium')}>{label}</span>
      {subtitle === undefined ? null : (
        <span className="truncate text-2xs text-muted-foreground">{subtitle}</span>
      )}
    </span>
    {tone === undefined ? null : (
      <StatusDot tone={tone} size={density === 'row' ? 'md' : 'sm'} ariaLabel={statusLabel} />
    )}
  </SelectableRow>
);
