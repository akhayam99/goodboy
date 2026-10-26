import { ChevronRight } from 'lucide-react';
import { ICON_SIZE, SelectableRow } from '@goodboy/ui';

type Props = {
  readonly count: number;
  readonly onOpen: () => void;
};

export const HistoryVersionsLink = ({ count, onOpen }: Props) => (
  <div className="flex px-2">
    <SelectableRow
      selected={false}
      ariaLabel={`Previous versions ${count}`}
      onClick={onOpen}
      className="min-h-9 items-center justify-between gap-2 rounded-sm px-2"
    >
      <span className="flex items-center gap-2">
        <ChevronRight size={ICON_SIZE.row} aria-hidden className="shrink-0 text-faint-foreground" />
        <span className="text-row text-muted-foreground">Previous versions</span>
      </span>
      <span className="text-meta tabular-nums text-faint-foreground">{count}</span>
    </SelectableRow>
  </div>
);
