import type { ReactNode } from 'react';
import { ChevronDown } from '@goodboy/ui/icons';
import { Button, Eyebrow, ICON_SIZE, cn } from '@goodboy/ui';
import { countSlotText } from '../../../../shared/utils/countSlotText';

type Fold = {
  readonly isOpen: boolean;
  readonly bodyId: string;
  readonly onToggle: () => void;
};

type Props = {
  readonly label: string;
  readonly headingId?: string;
  readonly count?: number;
  readonly meta?: ReactNode;
  readonly actions?: ReactNode;
  readonly fold?: Fold;
};

export const ContextCardHead = ({ label, headingId, count, meta, actions, fold }: Props) => {
  const countText = countSlotText({ count: count ?? null, isBesideGlyph: true });
  return (
    <div
      data-context-head=""
      className="flex h-8 min-w-0 items-center justify-between gap-2 pl-2 pr-1"
    >
      <div data-context-head-title="" className="flex min-w-0 items-center gap-2">
        <h2 id={headingId} className="flex min-w-0">
          {fold === undefined ? (
            <Eyebrow label={label} className="truncate" />
          ) : (
            <Button
              variant="quiet"
              size="xs"
              aria-expanded={fold.isOpen}
              aria-controls={fold.bodyId}
              onClick={fold.onToggle}
              className="min-w-0 px-0 text-eyebrow hover:bg-transparent"
            >
              <span className="truncate">{label}</span>
              <ChevronDown
                size={ICON_SIZE.row}
                aria-hidden
                className={cn(
                  'shrink-0 text-faint-foreground motion-safe:transition-transform',
                  !fold.isOpen && '-rotate-90',
                )}
              />
            </Button>
          )}
        </h2>
        {countText === null ? null : (
          <span data-context-count="" className="text-meta tabular-nums text-faint-foreground">
            {countText}
          </span>
        )}
        {meta ?? null}
      </div>
      {actions == null ? null : (
        <div data-context-head-actions="" className="flex shrink-0 items-center gap-1">
          {actions}
        </div>
      )}
    </div>
  );
};
