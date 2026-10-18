import { ChevronRight } from 'lucide-react';
import { ROW_INTERACTIVE, cn } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly count: number;
  readonly onOpen: () => void;
};

export const HistoryVersionsLink = ({ count, onOpen }: Props) => (
  <div className="flex px-2">
    <button
      type="button"
      aria-label={`Previous versions ${count}`}
      onClick={onOpen}
      className={cn(
        ROW_INTERACTIVE,
        'flex min-h-9 w-full items-center justify-between gap-2 rounded-sm px-2 text-left',
      )}
    >
      <span className="flex items-center gap-2">
        <ChevronRight size={ICON_SIZE.row} aria-hidden className="shrink-0 text-faint-foreground" />
        <span className="text-row text-muted-foreground">Previous versions</span>
      </span>
      <span className="text-meta tabular-nums text-faint-foreground">{count}</span>
    </button>
  </div>
);
