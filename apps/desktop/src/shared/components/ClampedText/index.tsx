import { useState, type ReactNode } from 'react';
import { cn } from '@goodboy/ui';

type Props = {
  readonly text: string;
  readonly children: ReactNode;
  readonly className?: string;
};

const CLAMP_LINES = 8;
const LONG_TEXT_LENGTH = CLAMP_LINES * 100;

export const ClampedText = ({ text, children, className }: Props) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const isLong = text.split('\n').length > CLAMP_LINES || text.length > LONG_TEXT_LENGTH;

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div
        data-clamped={isLong && !isExpanded ? 'true' : undefined}
        className={cn('min-w-0', isLong && !isExpanded && 'line-clamp-8', className)}
      >
        {children}
      </div>
      {isLong ? (
        <button
          type="button"
          onClick={() => setIsExpanded((value) => !value)}
          className="w-fit text-secondary text-muted-foreground hover:text-foreground"
        >
          {isExpanded ? 'Show less' : 'Show all'}
        </button>
      ) : null}
    </div>
  );
};
