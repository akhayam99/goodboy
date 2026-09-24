import type { ReactNode } from 'react';
import type { Tone } from '../tint';
import { SelectableRow } from './SelectableRow';
import { StatusDot } from './StatusDot';

export type StatusRailItemProps = {
  readonly icon: ReactNode;
  readonly label: string;
  readonly subtitle?: string;
  readonly tone: Tone;
  readonly selected: boolean;
  readonly onClick: () => void;
};

export const StatusRailItem = ({
  icon,
  label,
  subtitle,
  tone,
  selected,
  onClick,
}: StatusRailItemProps) => (
  <SelectableRow
    selected={selected}
    ariaCurrent={selected}
    onClick={onClick}
    className="items-center gap-2.5 px-2.5 py-2"
  >
    <span aria-hidden className="flex shrink-0 items-center">
      {icon}
    </span>
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="truncate text-sm font-medium text-foreground">{label}</span>
      {subtitle === undefined ? null : (
        <span className="truncate text-2xs text-muted-foreground">{subtitle}</span>
      )}
    </span>
    <StatusDot tone={tone} size="md" />
  </SelectableRow>
);
