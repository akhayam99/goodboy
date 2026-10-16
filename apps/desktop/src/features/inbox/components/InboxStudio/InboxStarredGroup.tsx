import { Button } from '@goodboy/ui';
import type { InboxRecord } from '../../types';
import type { StarredRow } from '../../useInboxStars';
import { TaskGroupRows } from './TaskGroupRows';

type Props = {
  readonly rows: ReadonlyArray<StarredRow>;
  readonly records: ReadonlyArray<InboxRecord>;
  readonly isExpanded: boolean;
  readonly selectedKey: string | null;
  readonly cursorKey: string | null;
  readonly unstarredCount: number;
  readonly onExpand: () => void;
  readonly onCollapse: () => void;
  readonly onSelect: (record: InboxRecord) => void;
  readonly onActivate: (record: InboxRecord) => void;
  readonly onUnstar: (record: InboxRecord) => void;
  readonly onUnstarClosed: () => void;
  readonly onUndoUnstar: () => void;
};

const STARRED = () => true;

export const InboxStarredGroup = ({
  rows,
  records,
  isExpanded,
  selectedKey,
  cursorKey,
  unstarredCount,
  onExpand,
  onCollapse,
  onSelect,
  onActivate,
  onUnstar,
  onUnstarClosed,
  onUndoUnstar,
}: Props) => {
  if (records.length === 0 && unstarredCount === 0) {
    return null;
  }
  const hasClosed = rows.some((row) => row.issue.state === 'done');
  const action = (() => {
    if (unstarredCount > 0) {
      return (
        <>
          <span>
            {unstarredCount === 1
              ? 'Unstarred 1 closed issue'
              : `Unstarred ${unstarredCount} closed issues`}
          </span>
          <Button variant="ghost" size="xs" onClick={onUndoUnstar}>
            Undo
          </Button>
        </>
      );
    }
    if (hasClosed) {
      return (
        <Button variant="ghost" size="xs" onClick={onUnstarClosed}>
          Unstar closed
        </Button>
      );
    }
    return undefined;
  })();
  return (
    <TaskGroupRows
      label="Starred"
      records={records}
      isExpanded={isExpanded}
      canCollapse
      action={action}
      selectedKey={selectedKey}
      cursorKey={cursorKey}
      onExpand={onExpand}
      onCollapse={onCollapse}
      onSelect={onSelect}
      onActivate={onActivate}
      starOf={STARRED}
      onToggleStar={onUnstar}
    />
  );
};
