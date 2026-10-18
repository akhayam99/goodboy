import { ROW_INTERACTIVE, cn } from '@goodboy/ui';
import { StepMark } from './StepMark';

type Props = {
  readonly title: string;
  readonly detail: string;
  readonly isDone: boolean;
  readonly actionLabel: string;
  readonly onOpen: (() => void) | null;
};

const ROW_CLASS = 'flex w-full items-center gap-2 rounded-md px-2 py-1 text-left';

export const StepRow = ({ title, detail, isDone, actionLabel, onOpen }: Props) => {
  const text = (
    <span className="flex min-w-0 flex-1 flex-col">
      <span
        className={cn('truncate text-row', isDone ? 'text-muted-foreground' : 'text-foreground')}
      >
        {title}
      </span>
      <span className="truncate text-meta text-faint-foreground">{detail}</span>
    </span>
  );
  if (isDone || onOpen === null) {
    return (
      <li data-state={isDone ? 'done' : 'open'} className={ROW_CLASS}>
        <StepMark isDone={isDone} />
        {text}
      </li>
    );
  }
  return (
    <li data-state="open">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${actionLabel} ${title}`}
        className={cn(ROW_CLASS, ROW_INTERACTIVE)}
      >
        <StepMark isDone={false} />
        {text}
        <span className="shrink-0 text-label text-primary">{actionLabel}</span>
      </button>
    </li>
  );
};
