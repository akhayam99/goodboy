import { useEffect, useRef, useState } from 'react';
import { ROW_INTERACTIVE, canAnimate, cn } from '@goodboy/ui';
import type { DemoChapter } from './demoChapters';
import type { HintTally } from './hints/hintTally';

export type UpNext = 'none' | 'soon' | 'ready';

type Props = {
  readonly chapter: DemoChapter;
  readonly ordinal: number;
  readonly isActive: boolean;
  readonly upNext: UpNext;
  readonly tally: HintTally;
  readonly onSelect: () => void;
  readonly onIntent: () => void;
};

const BREATH_MS = 2200;
const BREATH_CYCLES = 3;
const GLOW_FROM = '0 0 0 0 color-mix(in srgb, var(--color-primary) 0%, transparent)';
const GLOW_TO = '0 0 0 6px color-mix(in srgb, var(--color-primary) 28%, transparent)';

export const DemoRailRow = ({
  chapter,
  ordinal,
  isActive,
  upNext,
  tally,
  onSelect,
  onIntent,
}: Props) => {
  const rowRef = useRef<HTMLButtonElement>(null);
  const [isRested, setIsRested] = useState(false);
  const isPulsing = upNext === 'ready' && !isRested;

  useEffect(() => {
    if (upNext !== 'ready') {
      setIsRested(false);
      return;
    }
    const rest = window.setTimeout(() => setIsRested(true), BREATH_MS * BREATH_CYCLES);
    const row = rowRef.current;
    const breath =
      row !== null && canAnimate({ element: row })
        ? row.animate(
            [{ boxShadow: GLOW_FROM }, { boxShadow: GLOW_TO }, { boxShadow: GLOW_FROM }],
            {
              duration: BREATH_MS,
              iterations: BREATH_CYCLES,
              easing: 'ease-in-out',
            },
          )
        : undefined;
    return () => {
      window.clearTimeout(rest);
      breath?.cancel();
    };
  }, [upNext]);

  return (
    <button
      ref={rowRef}
      type="button"
      onClick={onSelect}
      onPointerEnter={onIntent}
      onPointerDown={onIntent}
      onFocus={onIntent}
      aria-current={isActive ? 'page' : undefined}
      data-selected={isActive ? 'true' : 'false'}
      data-up-next={upNext}
      data-pulsing={isPulsing ? 'true' : 'false'}
      className={cn(
        'grid w-full grid-cols-[20px_minmax(0,1fr)] items-baseline gap-3 rounded-lg px-3 py-2 text-left',
        ROW_INTERACTIVE,
        'data-[selected=true]:bg-selected data-[selected=true]:hover:bg-selected',
        'data-[up-next=soon]:ring-1 data-[up-next=soon]:ring-border-soft',
        'data-[up-next=ready]:bg-selected data-[up-next=ready]:ring-2 data-[up-next=ready]:ring-primary',
      )}
    >
      <span className={cn('text-meta', isActive ? 'text-primary' : 'text-faint-foreground')}>
        {String(ordinal).padStart(2, '0')}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="flex items-baseline justify-between gap-2">
          <span className="flex min-w-0 items-baseline gap-2">
            <span
              className={cn('text-row', isActive ? 'text-foreground' : 'text-muted-foreground')}
            >
              {chapter.title}
            </span>
            {chapter.isOptional === true ? (
              <span className="text-meta text-faint-foreground">Optional</span>
            ) : null}
          </span>
          {upNext === 'none' ? null : (
            <span className="shrink-0 text-meta text-primary">Up next</span>
          )}
        </span>
        {tally.total > 0 ? (
          <span
            className={cn(
              'text-meta',
              tally.tried > 0 ? 'text-muted-foreground' : 'text-faint-foreground',
            )}
          >
            {tally.tried} of {tally.total} tried
          </span>
        ) : null}
      </span>
    </button>
  );
};
