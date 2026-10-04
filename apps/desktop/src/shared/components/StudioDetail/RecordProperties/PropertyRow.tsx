import { ChevronDown } from 'lucide-react';
import { AnchoredPopover, Tooltip, cn, useDropdown } from '@goodboy/ui';
import type { ResolvedFact } from '../../../detail-fields/factTypes';
import { ICON_SIZE } from '../../conceptIcons';

type Props = {
  readonly fact: ResolvedFact;
};

const LABEL = 'w-[84px] shrink-0 text-meta text-faint-foreground';

export const PropertyRow = ({ fact }: Props) => {
  const dropdown = useDropdown({ width: 'w-60', expectedHeight: 240, expectedWidth: 240 });
  const Icon = fact.icon;
  const value = (
    <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-label text-foreground">
      {Icon == null ? null : (
        <Icon size={ICON_SIZE.control} aria-hidden className="shrink-0 text-faint-foreground" />
      )}
      <span className="min-w-0">{fact.node}</span>
    </span>
  );
  const editor = fact.editor;
  if (editor === undefined) {
    return (
      <div className="flex min-h-7 min-w-0 items-center gap-3 py-1">
        <span className={LABEL}>{fact.label}</span>
        {fact.hint == null ? value : <Tooltip content={fact.hint}>{value}</Tooltip>}
      </div>
    );
  }
  const actionLabel = `Change ${fact.label.toLowerCase()}`;
  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="menu"
      ariaLabel={actionLabel}
      anchorClassName="min-w-0"
      trigger={
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={dropdown.open}
          aria-label={actionLabel}
          onClick={dropdown.toggle}
          className={cn(
            'group/property flex min-h-7 w-full min-w-0 items-center gap-3 rounded-md py-1 text-left',
            'hover:bg-hover focus-visible:bg-hover',
            dropdown.open && 'bg-hover',
          )}
        >
          <span className={LABEL}>{fact.label}</span>
          {value}
          <ChevronDown
            size={12}
            aria-hidden
            className={cn(
              'shrink-0 text-faint-foreground opacity-0 group-hover/property:opacity-100 group-focus-visible/property:opacity-100',
              dropdown.open && 'opacity-100',
            )}
          />
        </button>
      }
    >
      {editor({ close: dropdown.close })}
    </AnchoredPopover>
  );
};
