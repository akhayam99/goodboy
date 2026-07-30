import { ArrowRight } from 'lucide-react';
import { cn } from '@goodboy/ui';

type Props = {
  readonly answerCount: number;
  readonly onClick: () => void;
};

export const AnswerSubmitButton = ({ answerCount, onClick }: Props) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold',
        'bg-primary text-primary-foreground shadow-sm motion-safe:transition-all duration-150',
        'hover:brightness-105 active:scale-[0.99]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
      )}
    >
      <span>{answerCount > 1 ? `send ${answerCount} answers` : 'send answer'}</span>
      <ArrowRight
        size={13}
        aria-hidden
        className="motion-safe:transition-transform group-hover:translate-x-0.5"
      />
    </button>
  );
};
