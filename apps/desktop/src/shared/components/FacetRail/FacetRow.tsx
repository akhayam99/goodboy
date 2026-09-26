import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { PANE_RHYTHM, SelectableRow, cn, tintClasses, type Tone } from '@goodboy/ui';
import { ICON_SIZE } from '../conceptIcons';

type LeadingProps =
  | { readonly icon: LucideIcon; readonly glyph?: undefined }
  | { readonly glyph: ReactNode; readonly icon?: undefined };

type Props = LeadingProps & {
  readonly tone?: Tone;
  readonly label: string;
  readonly count: number;
  readonly trailing?: ReactNode;
  readonly isSelected: boolean;
  readonly onClick: () => void;
};

export const FacetRow = ({
  icon: Icon,
  glyph,
  tone,
  label,
  count,
  trailing,
  isSelected,
  onClick,
}: Props) => {
  const isEmpty = count === 0 && !isSelected;
  return (
    <SelectableRow
      selected={isSelected}
      ariaCurrent={isSelected ? 'true' : undefined}
      onClick={onClick}
      className={cn('items-center gap-2 text-label', PANE_RHYTHM.navRail.row)}
    >
      {Icon != null ? (
        <Icon
          size={ICON_SIZE.row}
          aria-hidden
          className={cn(
            'shrink-0',
            isEmpty ? 'text-faint-foreground' : tone != null && tintClasses(tone).icon,
          )}
        />
      ) : (
        <span aria-hidden className={cn('flex shrink-0', isEmpty && 'opacity-60')}>
          {glyph}
        </span>
      )}
      <span className={cn('min-w-0 flex-1 truncate', isEmpty && 'text-faint-foreground')}>
        {label}
      </span>
      {trailing ?? <span className="shrink-0 text-meta text-faint-foreground">{count}</span>}
    </SelectableRow>
  );
};
