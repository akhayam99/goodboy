import { CircleCheck } from 'lucide-react';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';

type Props = {
  readonly label: string;
  readonly onUndo: (() => void) | null;
};

export const QuestionAnswerDone = ({ label, onUndo }: Props) => (
  <div className="flex min-w-0 items-center gap-2 text-label text-muted-foreground">
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
          className="rounded-sm text-foreground motion-safe:transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          Undo
        </button>
      </>
    )}
  </div>
);
