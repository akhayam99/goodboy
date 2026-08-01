import { cn } from '@goodboy/ui';
import { priorityTone } from '../priorityTone';

type Props = {
  readonly priority: number | null | undefined;
  readonly priorityLabel: string | null | undefined;
  readonly appearance?: 'dot' | 'labelled';
};

export const LinearPriority = ({ priority, priorityLabel, appearance = 'labelled' }: Props) => {
  const text = priorityLabel ?? 'No priority';
  const tone = priorityTone({ priority });

  if (appearance === 'dot') {
    return (
      <span
        aria-label={`Priority: ${text}`}
        className={cn('size-1.5 shrink-0 rounded-full', tone)}
      />
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-2xs text-muted-foreground">
      <span aria-hidden className={cn('size-2 rounded-full', tone)} />
      {text}
    </span>
  );
};
