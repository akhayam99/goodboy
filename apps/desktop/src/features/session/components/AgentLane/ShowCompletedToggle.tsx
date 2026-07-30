import { CircleCheck } from 'lucide-react';
import { cn } from '@goodboy/ui';

type Props = {
  readonly completedCount: number;
  readonly isShown: boolean;
  readonly onChange: (isShown: boolean) => void;
};

export const ShowCompletedToggle = ({ completedCount, isShown, onChange }: Props) => {
  if (completedCount === 0) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => onChange(!isShown)}
      aria-pressed={isShown}
      title={isShown ? 'hide completed agents' : 'show completed agents'}
      className={cn(
        'flex items-center gap-1 rounded-md px-1.5 py-0.5 text-2xs font-medium transition-colors',
        isShown
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground',
      )}
    >
      <CircleCheck size={10} aria-hidden />
      Completed ({completedCount})
    </button>
  );
};
