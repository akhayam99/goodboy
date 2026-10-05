import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import {
  AnchoredPopover,
  DiffLayoutToggle,
  cn,
  useDropdown,
  type DiffLayoutMode,
} from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly layout: DiffLayoutMode;
  readonly onLayout: (mode: DiffLayoutMode) => void;
  readonly wrap: boolean;
  readonly onWrap: (next: boolean) => void;
};

export const DisplayMenu = ({ layout, onLayout, wrap, onWrap }: Props) => {
  const dropdown = useDropdown({
    align: 'end',
    width: 'w-[240px]',
    expectedHeight: 140,
    expectedWidth: 240,
  });
  const isSplit = layout === 'split';
  const isWrapped = isSplit || wrap;
  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel="Display"
      className="flex flex-col gap-3 p-3"
      trigger={
        <button
          type="button"
          onClick={dropdown.toggle}
          aria-haspopup="dialog"
          aria-expanded={dropdown.open}
          className={cn(
            'inline-flex h-7 items-center gap-2 rounded-md px-2 text-label text-muted-foreground',
            'hover:bg-hover hover:text-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
            dropdown.open && 'bg-hover text-foreground',
          )}
        >
          <SlidersHorizontal size={ICON_SIZE.row} aria-hidden />
          Display
          <ChevronDown size={ICON_SIZE.row} aria-hidden className="text-faint-foreground" />
        </button>
      }
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-label text-muted-foreground">Layout</span>
        <DiffLayoutToggle mode={layout} onChange={onLayout} />
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={isWrapped}
        disabled={isSplit}
        title={isSplit ? 'Split view always wraps' : undefined}
        onClick={() => onWrap(!wrap)}
        className={cn(
          'flex items-center justify-between gap-3 rounded-sm text-label focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
          isSplit ? 'cursor-not-allowed text-faint-foreground' : 'text-foreground',
        )}
      >
        Wrap long lines
        <span
          aria-hidden
          className={cn(
            'relative h-4 w-7 shrink-0 rounded-full transition-colors',
            isWrapped ? 'bg-primary' : 'bg-border',
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 size-3 rounded-full bg-background transition-all',
              isWrapped ? 'left-3.5' : 'left-0.5',
            )}
          />
        </span>
      </button>
    </AnchoredPopover>
  );
};
