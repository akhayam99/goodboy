import { Button, ROW_INTERACTIVE, cn } from '@goodboy/ui';
import { StepMark } from './StepMark';

type Props = {
  readonly title: string;
  readonly detail: string;
  readonly actionLabel: string;
  readonly isLead: boolean;
  readonly onOpen: (() => void) | null;
};

const ROW_CLASS = 'flex w-full items-center gap-2 rounded-md px-2 py-1 text-left';

export const StepRow = ({ title, detail, actionLabel, isLead, onOpen }: Props) => {
  const text = (
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="truncate text-row text-foreground">{title}</span>
      <span className="truncate text-meta text-faint-foreground">{detail}</span>
    </span>
  );
  if (onOpen === null) {
    return (
      <li data-state="open" className={ROW_CLASS}>
        <StepMark isDone={false} />
        {text}
      </li>
    );
  }
  if (isLead) {
    return (
      <li data-state="open" data-lead="" className={ROW_CLASS}>
        <StepMark isDone={false} />
        {text}
        <Button
          variant="secondary"
          size="xs"
          onClick={onOpen}
          aria-label={`${actionLabel} ${title}`}
        >
          {actionLabel}
        </Button>
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
      </button>
    </li>
  );
};
