import { Button, Tooltip } from '@goodboy/ui';
import { KeyHints } from '../../ChangeTree/KeyHints';

type Props = {
  readonly viewedCount: number;
  readonly total: number;
  readonly onNext: () => void;
};

export const ReviewProgress = ({ viewedCount, total, onNext }: Props) => (
  <div className="flex shrink-0 items-center gap-2">
    <span className="text-meta tabular-nums text-muted-foreground">
      Viewed {viewedCount} of {total}
    </span>
    <Tooltip content="Go to the next file you haven't viewed">
      <Button
        size="xs"
        variant="secondary"
        aria-label="Next unviewed file"
        disabled={viewedCount === total}
        onClick={onNext}
      >
        Next
      </Button>
    </Tooltip>
    <KeyHints />
  </div>
);
