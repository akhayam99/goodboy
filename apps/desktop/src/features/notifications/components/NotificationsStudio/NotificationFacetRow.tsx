import type { LucideIcon } from 'lucide-react';
import { PANE_RHYTHM, SelectableRow, cn, tintClasses, type Tone } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly icon: LucideIcon;
  readonly tone?: Tone;
  readonly label: string;
  readonly count: number;
  readonly isSelected: boolean;
  readonly onClick: () => void;
};

export const NotificationFacetRow = ({
  icon: Icon,
  tone,
  label,
  count,
  isSelected,
  onClick,
}: Props) => {
  const isEmpty = count === 0 && !isSelected;
  return (
    <SelectableRow
      selected={isSelected}
      ariaCurrent={isSelected ? 'true' : undefined}
      onClick={onClick}
      className={cn('items-center gap-2 text-xs', PANE_RHYTHM.navRail.row)}
    >
      <Icon
        size={ICON_SIZE.row}
        aria-hidden
        className={cn(
          'shrink-0',
          isEmpty ? 'text-faint-foreground' : tone != null && tintClasses(tone).icon,
        )}
      />
      <span className={cn('min-w-0 flex-1 truncate', isEmpty && 'text-faint-foreground')}>
        {label}
      </span>
      <span className="shrink-0 text-3xs tabular-nums text-faint-foreground">{count}</span>
    </SelectableRow>
  );
};
