import { PanelRightClose } from 'lucide-react';
import { Button, IconButton, Tooltip } from '@goodboy/ui';
import { KeyHints } from './KeyHints';

type Props = {
  readonly viewedCount: number;
  readonly total: number;
  readonly onNext: () => void;
  readonly onFold: () => void;
};

export const TreeTitle = ({ viewedCount, total, onNext, onFold }: Props) => (
  <div className="flex shrink-0 items-center justify-between gap-1 px-2 pb-2">
    <div className="flex min-w-0 items-center gap-2">
      <span className="truncate text-meta tabular-nums text-muted-foreground">
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
    </div>
    <div className="flex shrink-0 items-center gap-1">
      <KeyHints />
      <IconButton icon={PanelRightClose} size="xs" label="Hide file list" onClick={onFold} />
    </div>
  </div>
);
