import {
  useCallback,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';
import { cn } from '../../cn';
import { ClaimedScrollerContext } from '../../useHeaderReveal/claimedScrollerContext';
import { HeaderRevealContext } from '../../useHeaderReveal/headerRevealContext';
import { PinnedInsetContext } from '../../useHeaderReveal/pinnedInsetContext';
import { OverlayThumb } from './OverlayThumb';

export type ScrollFadeProps = {
  readonly children: ReactNode;
  readonly className?: string;
  readonly viewportClassName?: string;
  readonly fadeFrom?: 'background' | 'subtle' | 'muted' | 'elevated' | 'floating';
  readonly fadeSize?: number | string;
  readonly orientation?: 'vertical' | 'horizontal';
  readonly viewportRef?: RefObject<HTMLDivElement | null>;
  readonly onViewportScroll?: () => void;
  readonly scrollbar?: 'overlay' | 'none';
  readonly fadeEdges?: 'both' | 'end';
  readonly edge?: 'fade' | 'line';
  readonly isPageScroller?: boolean;
  readonly isUnderPinned?: boolean;
};

const SPACING_CLASS_PATTERN = /^[wh]-(\d+(?:\.\d+)?)$/;
const TOP_PADDING_CLASS_PATTERN = /^p[ty]?-(\d+(?:\.\d+)?)$/;
const DEFAULT_FADE_PX = 32;
const LINE_EDGE_FADE_PX = 8;

const fadeSizeToPx = (fadeSize: number | string): number => {
  if (typeof fadeSize === 'number') {
    return fadeSize;
  }
  const match = SPACING_CLASS_PATTERN.exec(fadeSize);
  if (match === null) {
    return DEFAULT_FADE_PX;
  }
  return Number(match[1]) * 4;
};

type TopPaddingParams = {
  readonly className: string | undefined;
};

type InsetPaddingParams = {
  readonly ownTopPx: number;
};

const topPaddingPxOf = ({ className }: TopPaddingParams): number => {
  const tokens = (className ?? '').split(/\s+/);
  return tokens.reduce((px, token) => {
    const match = TOP_PADDING_CLASS_PATTERN.exec(token);
    return match === null ? px : Number(match[1]) * 4;
  }, 0);
};

const insetPaddingOf = ({ ownTopPx }: InsetPaddingParams): CSSProperties => {
  const padding = `calc(var(--reveal-inset, 0px) + ${ownTopPx}px)`;
  return { paddingTop: padding, scrollPaddingTop: padding };
};

export const ScrollFade = ({
  children,
  className,
  viewportClassName,
  fadeSize = 'h-8',
  orientation = 'vertical',
  viewportRef,
  onViewportScroll,
  scrollbar = 'overlay',
  fadeEdges = 'both',
  edge: edgeProp,
  isPageScroller: canBePageScroller = true,
  isUnderPinned: isUnderPinnedProp = false,
}: ScrollFadeProps) => {
  const ownRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const ref = viewportRef ?? ownRef;
  const horizontal = orientation === 'horizontal';
  const reveal = useContext(HeaderRevealContext);
  const isClaimed = useContext(ClaimedScrollerContext);
  const insetTop = useContext(PinnedInsetContext);
  const canReachUnder = insetTop !== null && !horizontal && !isUnderPinnedProp;
  const [isAtInsetTop, setAtInsetTop] = useState(false);
  const isReachingUnder = canReachUnder && isAtInsetTop;
  const isUnderPinned = isUnderPinnedProp || isReachingUnder;
  const ownTopPx = isUnderPinned ? topPaddingPxOf({ className: viewportClassName }) : 0;
  const isPageScroller = canBePageScroller && reveal !== null && !isClaimed && !horizontal;
  const edge = edgeProp ?? (isPageScroller && fadeEdges !== 'end' ? 'line' : 'fade');
  const isLineEdge = edge === 'line';
  const isDefaultLineEdge = isLineEdge && edgeProp === undefined;
  const fadePx = fadeSizeToPx(fadeSize);
  const frameRef = useRef<number | null>(null);

  const applyFade = useCallback(() => {
    const el = ref.current;
    if (el === null) {
      return;
    }
    const scrollPos = horizontal ? el.scrollLeft : el.scrollTop;
    const clientSize = horizontal ? el.clientWidth : el.clientHeight;
    const scrollSize = horizontal ? el.scrollWidth : el.scrollHeight;
    const maxScroll = Math.max(0, scrollSize - clientSize);
    const topFade = isLineEdge ? LINE_EDGE_FADE_PX : fadePx;
    const isTopSharp = fadeEdges === 'end' || isUnderPinned || isDefaultLineEdge;
    const top = isTopSharp ? 0 : Math.min(topFade, scrollPos);
    const bottom = Math.min(fadePx, Math.max(0, maxScroll - scrollPos));
    const hasFade = top > 0 || bottom > 0 || el.style.getPropertyValue('--fade-top') !== '';
    if (hasFade) {
      el.style.setProperty('--fade-top', `${top}px`);
      el.style.setProperty('--fade-bottom', `${bottom}px`);
    }
    const root = rootRef.current;
    if (!isLineEdge || root === null) {
      return;
    }
    if (scrollPos > 0) {
      root.setAttribute('data-scrolled', 'true');
      return;
    }
    root.removeAttribute('data-scrolled');
  }, [fadeEdges, fadePx, horizontal, isDefaultLineEdge, isLineEdge, isUnderPinned, ref]);

  const scheduleFade = useCallback(() => {
    if (frameRef.current !== null) {
      return;
    }
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      applyFade();
    });
  }, [applyFade]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (el === null) {
      return;
    }
    applyFade();
    const resize = new ResizeObserver(scheduleFade);
    resize.observe(el);
    const mutate = new MutationObserver(scheduleFade);
    mutate.observe(el, { childList: true, subtree: true });
    return () => {
      resize.disconnect();
      mutate.disconnect();
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [applyFade, scheduleFade, ref]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!canReachUnder || insetTop === null || root === null) {
      return;
    }
    const measure = () => {
      const offset = root.getBoundingClientRect().top - insetTop.getBoundingClientRect().top;
      setAtInsetTop(Math.abs(offset) < 1);
    };
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(root);
    return () => resize.disconnect();
  }, [canReachUnder, insetTop]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const viewport = ref.current;
    if (!isPageScroller || reveal === null || root === null || viewport === null) {
      return;
    }
    return reveal.register({ root, viewport });
  }, [isPageScroller, reveal, ref]);

  return (
    <div ref={rootRef} className={cn('relative min-h-0', isLineEdge && 'group/edge', className)}>
      <div
        ref={ref}
        onScroll={() => {
          scheduleFade();
          onViewportScroll?.();
        }}
        className={cn(
          horizontal
            ? 'mask-fade-x h-full max-w-[inherit] overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
            : 'mask-fade-y h-full max-h-[inherit] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          isUnderPinned && 'pt-[var(--reveal-inset,0px)] scroll-pt-[var(--reveal-inset,0px)]',
          viewportClassName,
          isReachingUnder &&
            'relative -top-[var(--reveal-inset,0px)] h-[calc(100%+var(--reveal-inset,0px))]',
        )}
        style={ownTopPx > 0 ? insetPaddingOf({ ownTopPx }) : undefined}
        data-page-scroller={isPageScroller ? '' : undefined}
        data-under-pinned={isReachingUnder ? '' : undefined}
      >
        <ClaimedScrollerContext.Provider value={isClaimed || isPageScroller || !canBePageScroller}>
          <PinnedInsetContext.Provider value={horizontal ? insetTop : null}>
            {children}
          </PinnedInsetContext.Provider>
        </ClaimedScrollerContext.Provider>
      </div>
      {isLineEdge && !horizontal ? (
        <span
          aria-hidden
          data-slot="scroll-edge"
          className={cn(
            'pointer-events-none absolute inset-x-0 z-10 h-px bg-border-soft opacity-0',
            isUnderPinnedProp ? 'top-[var(--reveal-inset,0px)]' : 'top-0',
            'motion-safe:transition-opacity motion-safe:duration-120 group-data-[scrolled=true]/edge:opacity-100',
          )}
        />
      ) : null}
      {scrollbar === 'overlay' ? (
        <OverlayThumb viewportRef={ref} orientation={orientation} />
      ) : null}
    </div>
  );
};
