import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import { Button, FLOATING_SURFACE, ICON_SIZE, IconButton, canAnimate, cn } from '@goodboy/ui';
import type { DemoRect } from './director/demoProtocol';
import type { HintSide } from './hints/demoHintTypes';
import { placeCallout } from './hints/placeCallout';
import { DemoSpotlight } from './DemoSpotlight';

export type CoachMark = {
  readonly hintId: string;
  readonly copy: string;
  readonly step: number;
  readonly total: number;
  readonly side: HintSide;
  readonly rect: DemoRect;
  readonly isSpotlit: boolean;
  readonly next?: NextChapter;
};

type NextChapter = {
  readonly id: string;
  readonly title: string;
};

type Size = {
  readonly width: number;
  readonly height: number;
};

type Props = {
  readonly coach: CoachMark;
  readonly scale: number;
  readonly bounds: Size;
  readonly onSkip: () => void;
  readonly onHide: () => void;
};

const RING_OUTSET = 4;
const GAP = 12;
const MARGIN = 16;
const CALLOUT_WIDTH = 240;
const CARET = 8;
const ENTER_MS = 120;

const ENTER_SHIFT = {
  bottom: 'translateY(-4px)',
  top: 'translateY(4px)',
  right: 'translateX(-4px)',
  left: 'translateX(4px)',
} as const satisfies Record<HintSide, string>;

const CARET_HALF = {
  bottom: '[clip-path:polygon(0_0,100%_0,0_100%)]',
  top: '[clip-path:polygon(100%_0,100%_100%,0_100%)]',
  right: '[clip-path:polygon(0_0,100%_100%,0_100%)]',
  left: '[clip-path:polygon(0_0,100%_0,100%_100%)]',
} as const satisfies Record<HintSide, string>;

type CaretParams = {
  readonly side: HintSide;
  readonly target: DemoRect;
  readonly x: number;
  readonly y: number;
  readonly height: number;
};

type AlongParams = {
  readonly value: number;
  readonly length: number;
};

const alongEdge = ({ value, length }: AlongParams): number =>
  Math.min(Math.max(value, CARET * 1.5), length - CARET * 2.5);

const CARET_OFFSET = -CARET / 2 - 1;

const caretStyle = ({ side, target, x, y, height }: CaretParams) => {
  if (side === 'bottom' || side === 'top') {
    const left = alongEdge({
      value: target.x + target.width / 2 - x - CARET / 2,
      length: CALLOUT_WIDTH,
    });
    return side === 'bottom' ? { left, top: CARET_OFFSET } : { left, bottom: CARET_OFFSET };
  }
  const top = alongEdge({ value: target.y + target.height / 2 - y - CARET / 2, length: height });
  return side === 'right' ? { top, left: CARET_OFFSET } : { top, right: CARET_OFFSET };
};

export const DemoCoachMark = ({ coach, scale, bounds, onSkip, onHide }: Props) => {
  const { next } = coach;
  const ringRef = useRef<HTMLDivElement>(null);
  const calloutRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);

  const target: DemoRect = {
    x: coach.rect.x * scale - RING_OUTSET,
    y: coach.rect.y * scale - RING_OUTSET,
    width: coach.rect.width * scale + RING_OUTSET * 2,
    height: coach.rect.height * scale + RING_OUTSET * 2,
  };

  useLayoutEffect(() => {
    setHeight(calloutRef.current?.offsetHeight ?? null);
  }, [coach.hintId, coach.copy]);

  const placement =
    height === null
      ? null
      : placeCallout({
          target,
          callout: { width: CALLOUT_WIDTH, height },
          bounds,
          side: coach.side,
          gap: GAP,
          margin: MARGIN,
        });
  const side = placement?.side ?? coach.side;

  useEffect(() => {
    const ring = ringRef.current;
    const callout = calloutRef.current;
    if (ring === null || callout === null || !canAnimate({ element: ring })) {
      return;
    }
    const outline = ring.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: ENTER_MS,
      easing: 'ease-out',
    });
    const enter = callout.animate(
      [
        { opacity: 0, transform: ENTER_SHIFT[side] },
        { opacity: 1, transform: 'none' },
      ],
      { duration: ENTER_MS, easing: 'ease-out' },
    );
    return () => {
      outline.cancel();
      enter.cancel();
    };
  }, [coach.hintId, side]);

  return (
    <div data-testid="demo-coach-mark" className="pointer-events-none absolute inset-0 z-20">
      {coach.isSpotlit ? <DemoSpotlight target={target} bounds={bounds} /> : null}
      <div
        ref={ringRef}
        aria-hidden
        className="absolute rounded-lg ring-2 ring-primary"
        style={{ left: target.x, top: target.y, width: target.width, height: target.height }}
      />
      <div
        ref={calloutRef}
        role="note"
        aria-label={next === undefined ? `Step ${coach.step} of ${coach.total}` : 'Group done'}
        data-side={side}
        className={cn('pointer-events-auto absolute flex flex-col gap-2 p-3', FLOATING_SURFACE)}
        style={{
          width: CALLOUT_WIDTH,
          left: placement?.x ?? 0,
          top: placement?.y ?? 0,
          visibility: placement === null ? 'hidden' : 'visible',
        }}
      >
        {placement === null ? null : (
          <span
            aria-hidden
            className={cn(
              'absolute size-2 rotate-45 border border-border bg-floating',
              CARET_HALF[side],
            )}
            style={caretStyle({
              side,
              target,
              x: placement.x,
              y: placement.y,
              height: height ?? 0,
            })}
          />
        )}
        <div className="flex items-start justify-between gap-2">
          <p className="text-row text-foreground">{coach.copy}</p>
          <IconButton icon={X} label="Hide hint" shortcut="Esc" size="xs" onClick={onHide} />
        </div>
        {next === undefined ? (
          <div className="flex items-center justify-between gap-2">
            <span className="text-meta text-faint-foreground">
              Step {coach.step} of {coach.total}
            </span>
            <Button size="xs" variant="quiet" onClick={onSkip}>
              Skip hint
            </Button>
          </div>
        ) : (
          <p className="flex items-center gap-2 text-ui text-muted-foreground">
            <ArrowLeft size={ICON_SIZE.control} className="shrink-0 text-primary" aria-hidden />
            <span>
              Up next in the list: <span className="text-foreground">{next.title}</span>
            </span>
          </p>
        )}
      </div>
    </div>
  );
};
