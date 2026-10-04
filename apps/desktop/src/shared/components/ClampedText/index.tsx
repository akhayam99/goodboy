import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@goodboy/ui';

type Props = {
  readonly text: string;
  readonly children: ReactNode;
  readonly className?: string;
};

const CLAMP_LINES = 8;
const LONG_TEXT_LENGTH = CLAMP_LINES * 100;

export const ClampedText = ({ text, children, className }: Props) => {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMeasuredOverflow, setIsMeasuredOverflow] = useState(false);
  const isLong = text.split('\n').length > CLAMP_LINES || text.length > LONG_TEXT_LENGTH;
  const canExpand = isLong || isMeasuredOverflow;

  useEffect(() => {
    const body = bodyRef.current;
    if (body === null || isExpanded) {
      return;
    }
    const measure = () => setIsMeasuredOverflow(body.scrollHeight > body.clientHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(body);
    return () => observer.disconnect();
  }, [isExpanded, text]);

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div
        ref={bodyRef}
        data-clamped={canExpand && !isExpanded ? 'true' : undefined}
        className={cn('min-w-0', !isExpanded && 'line-clamp-8', className)}
      >
        {children}
      </div>
      {canExpand ? (
        <button
          type="button"
          onClick={() => setIsExpanded((value) => !value)}
          className="w-fit text-meta text-muted-foreground hover:text-foreground"
        >
          {isExpanded ? 'Show less' : 'Show all'}
        </button>
      ) : null}
    </div>
  );
};
