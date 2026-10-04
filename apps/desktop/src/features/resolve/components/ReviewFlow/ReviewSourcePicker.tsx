import { Check, ChevronDown } from 'lucide-react';
import { REVIEW_SOURCE_LABEL } from '@goodboy/core';
import { AnchoredPopover, cn, useDropdown } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { ReviewSourceEntry } from '../../../../store/slices/review-source/types';
import { REVIEW_FLOW_LABEL } from '../../reviewFlowCopy';
import { ReviewSourceGlyph } from './ReviewSourceGlyph';

type Props = {
  readonly entries: ReadonlyArray<ReviewSourceEntry>;
  readonly selected: ReviewSourceEntry;
  readonly onSelect: (key: string) => void;
};

const sourceOptionLabel = ({ entry }: { readonly entry: ReviewSourceEntry }): string =>
  entry.kind === 'local' ? entry.label : `${entry.label} · ${REVIEW_SOURCE_LABEL[entry.kind]}`;

const sourceOpenLabel = ({ entry }: { readonly entry: ReviewSourceEntry }): string | null =>
  entry.openCount === null || entry.openCount === 0 ? null : `${entry.openCount} open`;

export const ReviewSourcePicker = ({ entries, selected, onSelect }: Props) => {
  const dropdown = useDropdown({ align: 'start', width: 'w-80', expectedHeight: 240 });
  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="menu"
      ariaLabel={REVIEW_FLOW_LABEL.sourcePicker}
      className="py-1"
      anchorClassName="inline-flex"
      trigger={
        <button
          type="button"
          onClick={dropdown.toggle}
          aria-haspopup="menu"
          aria-expanded={dropdown.open}
          aria-label={`${REVIEW_FLOW_LABEL.sourcePicker}: ${selected.label}`}
          className={cn(
            'flex h-6 items-center gap-1 rounded-md px-2 text-chip text-foreground motion-safe:transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
            dropdown.open && 'bg-hover',
          )}
        >
          <ReviewSourceGlyph kind={selected.kind} />
          {selected.label}
          <ChevronDown size={ICON_SIZE.row} aria-hidden className="text-faint-foreground" />
        </button>
      }
    >
      {entries.map((entry) => {
        const isSelected = entry.key === selected.key;
        const open = sourceOpenLabel({ entry });
        return (
          <button
            key={entry.key}
            type="button"
            role="menuitemradio"
            aria-checked={isSelected}
            onClick={() => {
              dropdown.close();
              onSelect(entry.key);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-foreground motion-safe:transition-colors hover:bg-hover focus-visible:bg-hover focus-visible:outline-none"
          >
            <ReviewSourceGlyph kind={entry.kind} />
            <span className="min-w-0 flex-1 truncate">{sourceOptionLabel({ entry })}</span>
            {open !== null && (
              <span className="text-meta tabular-nums text-muted-foreground">{open}</span>
            )}
            <span className="flex w-3.5 shrink-0 justify-end">
              {isSelected && (
                <Check size={ICON_SIZE.control} aria-hidden className="text-primary" />
              )}
            </span>
          </button>
        );
      })}
    </AnchoredPopover>
  );
};
