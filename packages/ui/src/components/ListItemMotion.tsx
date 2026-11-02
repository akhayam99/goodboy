import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '../cn';
import type { ListMotionPhase } from '../useListMotion';

type Props = {
  readonly phase: ListMotionPhase;
  readonly children: ReactNode;
};

export const ListItemMotion = ({ phase, children }: Props) => {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [isOpened, setIsOpened] = useState(phase !== 'entering');

  useLayoutEffect(() => {
    if (phase !== 'entering' || isOpened) {
      return;
    }
    frameRef.current?.getBoundingClientRect();
    setIsOpened(true);
  }, [phase, isOpened]);

  const isLeaving = phase === 'leaving' || phase === 'collapsing';
  const isClosed = phase === 'collapsing' || (phase === 'entering' && !isOpened);
  const isMoving = phase !== 'stable';

  return (
    <div
      ref={frameRef}
      data-list-motion={phase}
      aria-hidden={isLeaving ? true : undefined}
      inert={isLeaving}
      className={cn(
        isMoving
          ? 'grid motion-safe:transition-[grid-template-rows] motion-safe:duration-200 motion-safe:ease-enter'
          : 'contents',
        isMoving && (isClosed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]'),
      )}
    >
      <div className={cn(isMoving ? 'min-h-0 min-w-0 overflow-hidden' : 'contents')}>
        <div
          className={cn(
            isMoving ? 'min-w-0' : 'contents',
            phase === 'entering' && 'motion-safe:animate-pane-in',
            isLeaving && 'motion-safe:animate-item-out',
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
};
