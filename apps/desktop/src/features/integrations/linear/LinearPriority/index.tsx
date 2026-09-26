import { cn } from '@goodboy/ui';
import { priorityTone } from '../priorityTone';

type Props = {
  readonly priority: number | null | undefined;
  readonly priorityLabel: string | null | undefined;
  readonly appearance?: 'dot' | 'labelled';
};

export const LinearPriority = ({ priority, priorityLabel, appearance = 'labelled' }: Props) => {
  const text = priorityLabel ?? 'No priority';
  const mark = priorityTone({ priority });
  const isDash = mark.shape === 'dash';

  if (appearance === 'dot') {
    return (
      <span
        aria-label={`Priority: ${text}`}
        className={cn('shrink-0 rounded-full', isDash ? 'h-0.5 w-1.5' : 'size-1.5', mark.tone)}
      />
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-secondary text-muted-foreground">
      <span
        aria-hidden
        className={cn('rounded-full', isDash ? 'h-0.5 w-2' : 'size-2', mark.tone)}
      />
      {text}
    </span>
  );
};
