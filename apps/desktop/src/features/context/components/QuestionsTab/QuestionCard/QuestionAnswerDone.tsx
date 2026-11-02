import { CircleCheck } from 'lucide-react';
import { ICON_SIZE, FOCUS_RING, Tooltip, cn } from '@goodboy/ui';

type Props = {
  readonly label: string;
  readonly answer: string | null;
  readonly onUndo: (() => void) | null;
};

export const QuestionAnswerDone = ({ label, answer, onUndo }: Props) => (
  <div data-question-result="" className="flex min-w-0 flex-col gap-1">
    {answer !== null && (
      <Tooltip content={answer}>
        <p data-question-answer="" className="truncate text-row text-foreground select-text">
          {answer}
        </p>
      </Tooltip>
    )}
    <div className="flex min-w-0 items-center gap-2 text-meta text-muted-foreground">
      <CircleCheck size={ICON_SIZE.row} aria-hidden className="shrink-0 text-success" />
      <span role="status" className="min-w-0 truncate">
        {label}
      </span>
      {onUndo !== null && (
        <>
          <span aria-hidden>·</span>
          <button
            type="button"
            onClick={onUndo}
            className={cn(
              'rounded-sm text-foreground motion-safe:transition-colors hover:text-primary',
              FOCUS_RING,
            )}
          >
            Undo
          </button>
        </>
      )}
    </div>
  </div>
);
