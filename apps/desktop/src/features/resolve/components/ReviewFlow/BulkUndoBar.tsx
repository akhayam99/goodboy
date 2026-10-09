import { Button, KeyHint } from '@goodboy/ui';
import { REVIEW_BULK_LABEL, acceptedLine } from '../../reviewBulkCopy';

type Props = {
  readonly count: number;
  readonly hint: string;
  readonly isBusy: boolean;
  readonly onUndo: () => void;
};

export const BulkUndoBar = ({ count, hint, isBusy, onUndo }: Props) => (
  <div
    role="status"
    className="flex max-w-full items-center gap-2 rounded-lg border border-border bg-floating py-1 pl-3 pr-1 shadow-lg motion-safe:animate-studio-in"
  >
    <span className="whitespace-nowrap text-row tabular-nums text-foreground">
      {acceptedLine({ count })}
    </span>
    <Button size="sm" variant="ghost" isBusy={isBusy} onClick={onUndo}>
      {REVIEW_BULK_LABEL.undo}
      <KeyHint keys={hint} />
    </Button>
  </div>
);
