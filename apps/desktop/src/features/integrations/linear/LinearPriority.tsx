import { cn } from '@goodboy/ui';
import { priorityTone } from './priorityTone';

type Props = {
  readonly priority: number | null | undefined;
  readonly priorityLabel: string | null | undefined;
};

export const LinearPriority = ({ priority, priorityLabel }: Props) => {
  const text = priorityLabel ?? 'No priority';
  const mark = priorityTone({ priority });
  const isDash = mark.shape === 'dash';

  return (
    <span className="inline-flex items-center gap-1 text-meta text-muted-foreground">
      <span
        aria-hidden
        className={cn('rounded-full', isDash ? 'h-0.5 w-2' : 'size-2', mark.tone)}
      />
      {text}
    </span>
  );
};
