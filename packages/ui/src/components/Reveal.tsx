import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '../cn';

const SETTLE_FALLBACK_MS = 220;

type Phase = 'closed' | 'entering' | 'opening' | 'open' | 'closing';

export type RevealProps = {
  readonly open: boolean;
  readonly children: ReactNode;
  readonly id?: string;
  readonly className?: string;
  readonly onClosed?: () => void;
};

const hasTransition = (element: HTMLElement | null): boolean => {
  if (element === null) {
    return false;
  }
  const duration = window.getComputedStyle(element).transitionDuration;
  return duration.split(',').some((part) => Number.parseFloat(part) > 0);
};

export const Reveal = ({ open, children, id, className, onClosed }: RevealProps) => {
  const [phase, setPhase] = useState<Phase>(open ? 'open' : 'closed');
  const frame = useRef<HTMLDivElement | null>(null);
  const onClosedRef = useRef(onClosed);
  onClosedRef.current = onClosed;

  const settleClosed = () => {
    setPhase('closed');
    onClosedRef.current?.();
  };

  if (open && (phase === 'closed' || phase === 'closing')) {
    setPhase(phase === 'closed' ? 'entering' : 'opening');
  }
  if (!open && (phase === 'open' || phase === 'opening' || phase === 'entering')) {
    setPhase('closing');
  }

  useLayoutEffect(() => {
    if (phase === 'entering') {
      frame.current?.getBoundingClientRect();
      setPhase(hasTransition(frame.current) ? 'opening' : 'open');
      return;
    }
    if (phase === 'closing' && !hasTransition(frame.current)) {
      settleClosed();
    }
  }, [phase]);

  useEffect(() => {
    if (phase !== 'opening' && phase !== 'closing') {
      return;
    }
    const settle = phase === 'opening' ? () => setPhase('open') : settleClosed;
    const timer = window.setTimeout(settle, SETTLE_FALLBACK_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  if (phase === 'closed') {
    return null;
  }

  const isExpanded = phase === 'opening' || phase === 'open';

  return (
    <div
      ref={frame}
      id={id}
      data-state={isExpanded ? 'open' : 'closed'}
      onTransitionEnd={(event) => {
        if (event.target !== event.currentTarget) {
          return;
        }
        if (phase === 'opening') {
          setPhase('open');
        }
        if (phase === 'closing') {
          settleClosed();
        }
      }}
      className={cn(
        'grid motion-safe:transition-[grid-template-rows] motion-safe:duration-200 motion-safe:ease-out',
        isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
      )}
    >
      <div className={cn('min-h-0', phase !== 'open' && 'overflow-hidden')}>
        <div className={className}>{children}</div>
      </div>
    </div>
  );
};
