import { ChevronRight, Ellipsis } from 'lucide-react';
import { cn } from '../../cn';
import { useDropdown } from '../../useDropdown';
import { AnchoredPopover } from '../AnchoredPopover';
import { ScrollFade } from '../ScrollFade';
import { Tooltip } from '../Tooltip';
import type { TrailSegmentModel } from './types';
import { TRAIL_CRUMB_CLASS, TRAIL_LINK_CLASS } from './trailClasses';

type Props = {
  readonly segments: ReadonlyArray<TrailSegmentModel>;
};

export const TrailFold = ({ segments }: Props) => {
  const dropdown = useDropdown({
    align: 'start',
    expectedHeight: 30 * segments.length + 8,
    expectedWidth: 240,
    width: 'w-60 max-w-[calc(100vw-2rem)]',
  });
  const { open, close, toggle } = dropdown;

  return (
    <span
      data-trail-fold=""
      className="flex shrink-0 items-center gap-1.5 motion-safe:animate-fade-in"
    >
      <ChevronRight size={12} aria-hidden className="shrink-0 text-faint-foreground" />
      <AnchoredPopover
        dropdown={dropdown}
        role="menu"
        ariaLabel="Folded crumbs"
        anchorClassName="flex min-w-0 items-center"
        trigger={
          <Tooltip content="Show folded crumbs" anchorClassName="flex shrink-0">
            <button
              type="button"
              onClick={toggle}
              aria-label="Show folded crumbs"
              aria-haspopup="menu"
              aria-expanded={open}
              className={cn(TRAIL_CRUMB_CLASS, TRAIL_LINK_CLASS)}
            >
              <Ellipsis size={12} aria-hidden />
            </button>
          </Tooltip>
        }
      >
        <ScrollFade className="min-h-0 flex-1" fadeFrom="floating">
          <div className="flex min-w-0 flex-col gap-0.5 p-1">
            {segments.map((segment) => {
              const Icon = segment.icon;
              return (
                <button
                  key={segment.id}
                  type="button"
                  role="menuitem"
                  disabled={segment.onSelect == null}
                  onClick={() => {
                    close();
                    segment.onSelect?.();
                  }}
                  className="flex h-7.5 w-full min-w-0 items-center gap-2 rounded-md px-2 text-left text-label text-muted-foreground transition-colors hover:bg-hover hover:text-foreground disabled:hover:bg-transparent"
                >
                  <Icon
                    size={12}
                    aria-hidden
                    className={cn('shrink-0', segment.iconClassName ?? 'text-faint-foreground')}
                  />
                  <span className="min-w-0 flex-1 truncate">{segment.label}</span>
                </button>
              );
            })}
          </div>
        </ScrollFade>
      </AnchoredPopover>
    </span>
  );
};
