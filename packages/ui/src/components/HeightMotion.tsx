import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '../cn';
import { DURATION_BASE_MS } from '../motionTimings';

type Props = {
  readonly children: ReactNode;
  readonly className?: string;
  readonly isOpen?: boolean;
  readonly parentGapRem?: number;
};

type MotionStateParams = {
  readonly isMoving: boolean;
  readonly isClosed: boolean;
};

const motionStateOf = ({ isMoving, isClosed }: MotionStateParams) => {
  if (isMoving) {
    return 'moving';
  }
  if (isClosed) {
    return 'closed';
  }
  return 'rest';
};

export const HeightMotion = ({ children, className, isOpen = true, parentGapRem = 0 }: Props) => {
  const innerRef = useRef<HTMLDivElement | null>(null);
  const lastHeightRef = useRef<number | null>(isOpen ? null : 0);
  const [height, setHeight] = useState<number | null>(isOpen ? null : 0);
  const [isMoving, setIsMoving] = useState(false);
  const [wasOpen, setWasOpen] = useState(isOpen);

  if (wasOpen !== isOpen) {
    setWasOpen(isOpen);
    setIsMoving(true);
  }

  useLayoutEffect(() => {
    const inner = innerRef.current;
    if (inner === null || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(() => {
      const next = inner.getBoundingClientRect().height;
      if (lastHeightRef.current !== null && lastHeightRef.current !== next) {
        setIsMoving(true);
      }
      lastHeightRef.current = next;
      setHeight(next);
    });
    if (lastHeightRef.current === null && inner.getBoundingClientRect().height === 0) {
      lastHeightRef.current = 0;
      setHeight(0);
    }
    observer.observe(inner);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isMoving) {
      return;
    }
    const timer = window.setTimeout(() => setIsMoving(false), DURATION_BASE_MS);
    return () => window.clearTimeout(timer);
  }, [isMoving, height]);

  const isClosed = !isOpen && !isMoving;
  const isEmpty = isOpen && !isMoving && height === 0;
  const shownHeight = isClosed ? 0 : height;

  return (
    <div
      aria-hidden={isClosed ? true : undefined}
      inert={isClosed}
      data-height-motion={motionStateOf({ isMoving, isClosed })}
      style={{
        height: shownHeight ?? undefined,
        marginTop: isOpen && !isEmpty ? undefined : `${-parentGapRem}rem`,
      }}
      className={cn(
        'min-w-0 motion-safe:duration-200 motion-safe:ease-enter',
        isEmpty ? 'motion-safe:transition-[height]' : 'motion-safe:transition-[height,margin]',
        (isMoving || isClosed) && 'overflow-hidden',
      )}
    >
      <div ref={innerRef} className={className}>
        {children}
      </div>
    </div>
  );
};
