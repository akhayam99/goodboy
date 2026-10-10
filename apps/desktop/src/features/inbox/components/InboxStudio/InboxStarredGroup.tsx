import { Button, Eyebrow } from '@goodboy/ui';
import { placeholderRecordOf } from '../../../integrations/starred/placeholderRecordOf';
import type { InboxRecord } from '../../types';
import type { StarredRow } from '../../useInboxStars';
import { InboxRow } from './InboxRow';
import { StarredSnapshotRow } from './StarredSnapshotRow';

type Props = {
  readonly rows: ReadonlyArray<StarredRow>;
  readonly selectedKey: string | null;
  readonly cursorKey?: string | null;
  readonly unstarredCount: number;
  readonly onSelect: (record: InboxRecord) => void;
  readonly onActivate?: (record: InboxRecord) => void;
  readonly onUnstar: (row: StarredRow) => void;
  readonly onUnstarClosed: () => void;
  readonly onUndoUnstar: () => void;
};

export const InboxStarredGroup = ({
  rows,
  selectedKey,
  cursorKey,
  unstarredCount,
  onSelect,
  onActivate,
  onUnstar,
  onUnstarClosed,
  onUndoUnstar,
}: Props) => {
  if (rows.length === 0 && unstarredCount === 0) {
    return null;
  }
  const hasClosed = rows.some((row) => row.issue.state === 'done');
  return (
    <section aria-label="Starred" className="flex flex-col gap-0.5 pb-2">
      <div className="flex items-center gap-2 px-3 pb-1">
        <Eyebrow label="Starred" />
        <span className="text-meta tabular-nums text-faint-foreground">{rows.length}</span>
        <span className="flex-1" />
        {unstarredCount > 0 ? (
          <>
            <span className="text-meta text-muted-foreground">
              {unstarredCount === 1
                ? 'Unstarred 1 closed issue'
                : `Unstarred ${unstarredCount} closed issues`}
            </span>
            <Button variant="ghost" size="sm" onClick={onUndoUnstar}>
              Undo
            </Button>
          </>
        ) : hasClosed ? (
          <Button variant="ghost" size="sm" onClick={onUnstarClosed}>
            Unstar closed
          </Button>
        ) : null}
      </div>
      {rows.map((row) => {
        if (row.record !== null) {
          return (
            <InboxRow
              key={row.record.key}
              record={row.record}
              selected={selectedKey === row.record.key}
              isCursor={cursorKey === row.record.key}
              onSelect={onSelect}
              onActivate={onActivate}
              isStarred
              onToggleStar={() => onUnstar(row)}
            />
          );
        }
        const placeholder = placeholderRecordOf(row.issue);
        if (placeholder === null) {
          return null;
        }
        return (
          <StarredSnapshotRow
            key={`${row.issue.provider}:${row.issue.externalId}`}
            issue={row.issue}
            recordKey={placeholder.key}
            selected={selectedKey === placeholder.key}
            isCursor={cursorKey === placeholder.key}
            onSelect={() => onSelect(placeholder)}
            onUnstar={() => onUnstar(row)}
          />
        );
      })}
    </section>
  );
};
