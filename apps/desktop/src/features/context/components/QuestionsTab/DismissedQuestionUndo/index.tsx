import { TranscriptShell } from '../../../../chat/components/TranscriptShell';

type Props = {
  readonly onUndo: () => void;
};

export const DismissedQuestionUndo = ({ onUndo }: Props) => {
  return (
    <TranscriptShell
      tone="neutral"
      variant="leftBorder"
      className="flex items-center justify-between gap-2 text-xs text-muted-foreground"
    >
      <span>Dismissed -</span>
      <button
        type="button"
        onClick={onUndo}
        className="rounded-md px-2 py-1 font-medium text-foreground transition-colors hover:bg-muted"
      >
        Undo
      </button>
    </TranscriptShell>
  );
};
