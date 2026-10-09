import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { StatCard, cn, tintClasses } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { ImpactDelta } from '../../utils/impactDelta';

type Props = {
  readonly label: string;
  readonly value: string;
  readonly delta: ImpactDelta | null;
  readonly title?: string;
  readonly hint?: string;
  readonly onSelect: () => void;
};

const DELTA_ICON = {
  up: ArrowUp,
  down: ArrowDown,
  flat: Minus,
} as const;

export const KpiTile = ({ label, value, delta, title, hint, onSelect }: Props) => {
  const Icon = delta === null ? null : DELTA_ICON[delta.direction];
  const status =
    delta === null || Icon === null ? undefined : (
      <span
        className={cn(
          'flex shrink-0 items-center gap-1 text-meta',
          delta.isBetter ? tintClasses('success').text : 'text-muted-foreground',
        )}
      >
        <Icon size={ICON_SIZE.row} aria-hidden />
        {delta.label}
      </span>
    );
  return (
    <div title={title} className="flex min-w-0">
      <StatCard
        label={label}
        value={value}
        {...(status !== undefined && { status })}
        {...(hint !== undefined && { hint })}
        reservesDeltaRow
        onClick={onSelect}
        className="w-full"
      />
    </div>
  );
};
