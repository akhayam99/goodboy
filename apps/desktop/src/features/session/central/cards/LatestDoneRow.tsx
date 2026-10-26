import { InteractiveRow, StateDot } from '@goodboy/ui';
import { formatAge } from '../../../../shared/utils/time/formatAge';
import type { LatestDoneItem } from './latestDoneOf';

type Props = {
  readonly item: LatestDoneItem;
  readonly nowMs: number;
  readonly openLabel: string;
  readonly onOpen: () => void;
};

export const LatestDoneRow = ({ item, nowMs, openLabel, onOpen }: Props) => {
  const { row, isUnread } = item;
  return (
    <li data-done-latest={row.id} data-unread={isUnread ? '' : undefined} className="min-w-0">
      <InteractiveRow
        label={openLabel}
        isSelected={false}
        onOpen={onOpen}
        className="grid min-h-9 min-w-0 grid-cols-[1rem_minmax(0,1fr)_auto] items-center gap-x-2 px-2 py-1"
      >
        <span className="flex size-4 items-center justify-center">
          {isUnread ? <StateDot state="unread" label="Unread reply" /> : null}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-row text-foreground">{row.title}</span>
          <span className="truncate text-meta text-muted-foreground">{row.by}</span>
        </span>
        <span className="text-meta tabular-nums text-faint-foreground">
          {formatAge({ from: row.at, now: nowMs })}
        </span>
      </InteractiveRow>
    </li>
  );
};
