import { ArrowRight } from 'lucide-react';
import { cn } from '@goodboy/ui';

type Props = {
  readonly answerCount: number;
  readonly totalCount: number;
  readonly onClick: () => void;
};

const readyLabel = ({
  answerCount,
  totalCount,
}: {
  readonly answerCount: number;
  readonly totalCount: number;
}): string => {
  if (totalCount <= 1) {
    return 'ready to send';
  }
  return `${answerCount} of ${totalCount} answered`;
};

export const AnswerSubmitButton = ({ answerCount, totalCount, onClick }: Props) => {
  return (
    <div className="flex items-center justify-between gap-3 pl-6 pt-1">
      <span aria-live="polite" className="text-2xs font-medium tabular-nums text-muted-foreground">
        {readyLabel({ answerCount, totalCount })}
      </span>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'group inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold',
          'bg-primary text-primary-foreground shadow-inset-primary',
          'transition-[filter,transform,box-shadow] duration-150 motion-safe:will-change-transform',
          'hover:brightness-105 active:scale-[0.98]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        )}
      >
        <span>Send</span>
        <ArrowRight
          size={12}
          aria-hidden
          className="motion-safe:transition-transform group-hover:translate-x-0.5"
        />
      </button>
    </div>
  );
};
