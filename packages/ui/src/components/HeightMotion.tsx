import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '../cn';
import { DURATION_BASE_MS } from '../motionTimings';

type Props = {
  readonly children: ReactNode;
  readonly className?: string;
  readonly isOpen?: boolean;
};

export const HeightMotion = ({ children, className, isOpen = true }: Props) => {
  const innerRef = useRef<HTMLDivElement | null>(null);
  const lastHeightRef = useRef<number | null>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [isMoving, setIsMoving] = useState(false);

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

  const isHidden = !isOpen && !isMoving;

  return (
    <div
      hidden={isHidden}
      data-height-motion={isMoving ? 'moving' : 'rest'}
      style={height === null ? undefined : { height }}
      className={cn(
        'min-w-0 motion-safe:transition-[height] motion-safe:duration-200 motion-safe:ease-enter',
        isMoving && 'overflow-hidden',
      )}
    >
      <div ref={innerRef} className={className}>
        {children}
      </div>
    </div>
  );
};
