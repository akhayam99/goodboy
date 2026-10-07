import {
  useCallback,
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';
import { cn } from '../../cn';
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
};

const SPACING_CLASS_PATTERN = /^[wh]-(\d+(?:\.\d+)?)$/;
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

const maskStyleFor = ({ horizontal }: { horizontal: boolean }): CSSProperties => {
  const direction = horizontal ? 'to right' : 'to bottom';
  const image = `linear-gradient(${direction}, transparent, #000 var(--fade-top, 0px), #000 calc(100% - var(--fade-bottom, 0px)), transparent)`;
  return { maskImage: image, WebkitMaskImage: image };
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
  edge = 'fade',
}: ScrollFadeProps) => {
  const ownRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const ref = viewportRef ?? ownRef;
  const isLineEdge = edge === 'line';
  const horizontal = orientation === 'horizontal';
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
    const top = fadeEdges === 'end' ? 0 : Math.min(topFade, scrollPos);
    const bottom = Math.min(fadePx, Math.max(0, maxScroll - scrollPos));
    el.style.setProperty('--fade-top', `${top}px`);
    el.style.setProperty('--fade-bottom', `${bottom}px`);
    const root = rootRef.current;
    if (!isLineEdge || root === null) {
      return;
    }
    if (scrollPos > 0) {
      root.setAttribute('data-scrolled', 'true');
      return;
    }
    root.removeAttribute('data-scrolled');
  }, [fadeEdges, fadePx, horizontal, isLineEdge, ref]);

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

  return (
    <div ref={rootRef} className={cn('relative min-h-0', isLineEdge && 'group/edge', className)}>
      <div
        ref={ref}
        onScroll={() => {
          scheduleFade();
          onViewportScroll?.();
        }}
        style={maskStyleFor({ horizontal })}
        className={cn(
          horizontal
            ? 'h-full max-w-[inherit] overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
            : 'h-full max-h-[inherit] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          viewportClassName,
        )}
      >
        {children}
      </div>
      {isLineEdge && !horizontal ? (
        <span
          aria-hidden
          data-slot="scroll-edge"
          className={cn(
            'pointer-events-none absolute inset-x-0 top-0 z-10 h-px bg-border-soft opacity-0',
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
