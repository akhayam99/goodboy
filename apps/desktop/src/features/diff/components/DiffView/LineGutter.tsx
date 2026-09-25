import type { PointerEvent } from 'react';
import { Plus } from 'lucide-react';
import { cn } from '@goodboy/ui';
import type { DiffCommentSide } from '@goodboy/types';

type Props = {
  readonly className?: string;
  readonly side: DiffCommentSide;
  readonly lineNumber: number | null;
  readonly canComment: boolean;
  readonly showPlus: boolean;
  readonly isSelected: boolean;
  readonly onPress: (side: DiffCommentSide, lineNumber: number, extend: boolean) => void;
  readonly onHover: (side: DiffCommentSide, lineNumber: number) => void;
  readonly onActivate: (side: DiffCommentSide, lineNumber: number) => void;
};

export const LineGutter = ({
  className,
  side,
  lineNumber,
  canComment,
  showPlus,
  isSelected,
  onPress,
  onHover,
  onActivate,
}: Props) => {
  const base =
    'relative select-none px-1.5 text-right font-mono text-2xs tabular-nums leading-5 text-faint-foreground';
  if (lineNumber === null || !canComment) {
    return (
      <div role="gridcell" className={cn(base, className)}>
        {lineNumber ?? ''}
      </div>
    );
  }
  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    onPress(side, lineNumber, event.shiftKey);
  };
  return (
    <div role="gridcell" className={cn('relative', className)}>
      <button
        type="button"
        aria-label={`Comment on ${side} line ${lineNumber}`}
        onPointerDown={handlePointerDown}
        onPointerEnter={() => onHover(side, lineNumber)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') {
            return;
          }
          event.preventDefault();
          onActivate(side, lineNumber);
        }}
        className={cn(
          base,
          'block h-full w-full cursor-pointer transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring',
          isSelected && 'text-primary',
        )}
      >
        {showPlus ? (
          <span
            aria-hidden
            className="absolute left-1 top-0.5 hidden size-4 items-center justify-center rounded-sm bg-primary text-on-tone group-hover/line:flex"
          >
            <Plus size={10} strokeWidth={2.5} />
          </span>
        ) : null}
        {lineNumber}
      </button>
    </div>
  );
};
