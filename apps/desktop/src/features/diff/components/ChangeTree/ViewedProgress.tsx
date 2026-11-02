import { Button, Tooltip } from '@goodboy/ui';

type Props = {
  readonly viewed: number;
  readonly total: number;
  readonly onNext: () => void;
};

export const ViewedProgress = ({ viewed, total, onNext }: Props) => (
  <div className="flex min-w-0 items-center gap-2">
    <span className="truncate text-meta tabular-nums text-muted-foreground">
      Viewed {viewed} of {total}
    </span>
    <Tooltip content="Go to the next file you haven't viewed">
      <Button
        size="xs"
        variant="quiet"
        aria-label="Next unviewed file"
        disabled={viewed === total}
        onClick={onNext}
      >
        Next
      </Button>
    </Tooltip>
  </div>
);
