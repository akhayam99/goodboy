import {
  Activity,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type UIEvent,
} from 'react';
import { canAnimate } from '../canAnimate';
import { cn } from '../cn';
import { DURATION_QUICK_MS } from '../motionTimings';

export type PaneLayer = {
  readonly key: string;
  readonly content: ReactNode;
};

type Props = {
  readonly activeKey: string | null;
  readonly layers: ReadonlyArray<PaneLayer>;
  readonly className?: string;
  readonly shouldFocusTitle?: boolean;
};

type SwapState = {
  readonly activeKey: string | null;
  readonly leavingKey: string | null;
  readonly isAnimated: boolean;
};

type ScrollMark = {
  readonly top: number;
  readonly left: number;
};

type ScrollsByLayer = Map<string, Map<Element, ScrollMark>>;

type RememberParams = {
  readonly layerKey: string;
  readonly event: UIEvent;
};

export const PaneSwap = ({ activeKey, layers, className, shouldFocusTitle = false }: Props) => {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const previousKeyRef = useRef<string | null>(activeKey);
  const scrollsRef = useRef<ScrollsByLayer>(new Map());
  const [swap, setSwap] = useState<SwapState>({
    activeKey,
    leavingKey: null,
    isAnimated: false,
  });

  let leavingKey = swap.leavingKey;
  if (swap.activeKey !== activeKey) {
    const from = swap.activeKey;
    const isLeavable = from !== null && layers.some((layer) => layer.key === from);
    const isAnimated = canAnimate({ element: frameRef.current });
    leavingKey = isLeavable && isAnimated ? from : null;
    setSwap({ activeKey, leavingKey, isAnimated });
  }

  useEffect(() => {
    if (leavingKey === null) {
      return;
    }
    const timer = window.setTimeout(
      () => setSwap((prev) => ({ ...prev, leavingKey: null })),
      DURATION_QUICK_MS,
    );
    return () => window.clearTimeout(timer);
  }, [leavingKey]);

  useLayoutEffect(() => {
    if (activeKey === null) {
      return;
    }
    scrollsRef.current.get(activeKey)?.forEach((mark, element) => {
      if (!element.isConnected) {
        return;
      }
      element.scrollTop = mark.top;
      element.scrollLeft = mark.left;
    });
    const frame = frameRef.current;
    const previousKey = previousKeyRef.current;
    previousKeyRef.current = activeKey;
    if (!shouldFocusTitle || frame === null || previousKey === activeKey) {
      return;
    }
    const focused = document.activeElement;
    const isFocusFree = focused === null || focused === document.body || frame.contains(focused);
    const title = frame.querySelector<HTMLElement>(`[data-pane-layer="${activeKey}"] h1`);
    if (!isFocusFree || title === null) {
      return;
    }
    if (!title.hasAttribute('tabindex')) {
      title.setAttribute('tabindex', '-1');
    }
    title.focus({ preventScroll: true });
  }, [activeKey, shouldFocusTitle]);

  const rememberScroll = ({ layerKey, event }: RememberParams) => {
    const { target, currentTarget } = event;
    if (
      !(target instanceof Element) ||
      currentTarget.getAttribute('data-pane-state') === 'hidden'
    ) {
      return;
    }
    const marks = scrollsRef.current.get(layerKey) ?? new Map<Element, ScrollMark>();
    marks.set(target, { top: target.scrollTop, left: target.scrollLeft });
    scrollsRef.current.set(layerKey, marks);
  };

  return (
    <div ref={frameRef} className={cn('relative h-full w-full', className)}>
      {layers.map((layer) => {
        const isActive = layer.key === activeKey;
        const isLeaving = layer.key === leavingKey;
        return (
          <Activity key={layer.key} mode={isActive || isLeaving ? 'visible' : 'hidden'}>
            <div
              data-pane-layer={layer.key}
              data-pane-state={isActive ? 'active' : isLeaving ? 'leaving' : 'hidden'}
              aria-hidden={isLeaving ? true : undefined}
              inert={isLeaving}
              onScrollCapture={(event) => rememberScroll({ layerKey: layer.key, event })}
              className={cn(
                'absolute inset-0',
                isActive && swap.isAnimated && 'motion-safe:animate-pane-in',
                isLeaving && 'pointer-events-none motion-safe:animate-pane-out',
              )}
            >
              {layer.content}
            </div>
          </Activity>
        );
      })}
    </div>
  );
};
