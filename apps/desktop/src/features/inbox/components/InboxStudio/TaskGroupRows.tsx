import { useEffect, useRef, type ReactNode } from 'react';
import { ListGridGroup, ListGridLine } from '@goodboy/ui';
import { useVirtualRows } from '../../../../shared/hooks/useVirtualRows';
import { TASK_GROUP_CAP, TASK_VIRTUAL_MIN, shownTaskRecords } from '../../shownTaskRecords';
import type { InboxRecord } from '../../types';
import { InboxRow, inboxOptionId } from './InboxRow';
import { TASK_ROW_HEIGHT } from './taskColumns';

export type TaskLine = {
  readonly key: string;
  readonly text: string;
  readonly onClick?: () => void;
};

type Props = {
  readonly label: string;
  readonly records: ReadonlyArray<InboxRecord>;
  readonly isExpanded: boolean;
  readonly canCollapse: boolean;
  readonly lines?: ReadonlyArray<TaskLine>;
  readonly action?: ReactNode;
  readonly selectedKey: string | null;
  readonly cursorKey: string | null;
  readonly onExpand: () => void;
  readonly onCollapse: () => void;
  readonly onSelect: (record: InboxRecord) => void;
  readonly onActivate: (record: InboxRecord) => void;
  readonly starOf: (record: InboxRecord) => boolean | undefined;
  readonly onToggleStar: (record: InboxRecord) => void;
};

type PositionParams = {
  readonly cursorIndex: number;
  readonly firstVisible: number;
  readonly total: number;
};

const positionOf = ({ cursorIndex, firstVisible, total }: PositionParams): string =>
  `${(cursorIndex === -1 ? firstVisible : cursorIndex) + 1} of ${total}`;

export const TaskGroupRows = ({
  label,
  records,
  isExpanded,
  canCollapse,
  lines = [],
  action,
  selectedKey,
  cursorKey,
  onExpand,
  onCollapse,
  onSelect,
  onActivate,
  starOf,
  onToggleStar,
}: Props) => {
  const anchorRef = useRef<HTMLLIElement | null>(null);
  const shown = shownTaskRecords({ records, isExpanded });
  const isVirtual = isExpanded && records.length >= TASK_VIRTUAL_MIN;
  const range = useVirtualRows({
    count: shown.length,
    rowHeight: TASK_ROW_HEIGHT,
    anchorRef,
    isEnabled: isVirtual,
  });
  const cursorIndex = isVirtual ? shown.findIndex((record) => record.key === cursorKey) : -1;
  const { scrollToIndex } = range;

  useEffect(() => {
    if (cursorIndex === -1) {
      return;
    }
    scrollToIndex(cursorIndex);
  }, [cursorIndex, scrollToIndex]);

  const span = isVirtual ? range : { start: 0, end: shown.length, firstVisible: 0 };
  const isCapped = !isExpanded && records.length > TASK_GROUP_CAP;

  const rendered = shown.slice(span.start, span.end);
  const cursorRow = rendered.find((record) => record.key === cursorKey);
  const foot = (() => {
    if (isCapped) {
      return <ListGridLine onClick={onExpand}>{`Show all ${records.length}`}</ListGridLine>;
    }
    if (isExpanded && canCollapse && records.length > TASK_GROUP_CAP) {
      return <ListGridLine onClick={onCollapse}>Show fewer</ListGridLine>;
    }
    return null;
  })();

  return (
    <ListGridGroup
      label={label}
      isListbox={records.length > 0}
      headingLevel={2}
      isSticky={isVirtual}
      action={
        isVirtual
          ? positionOf({ cursorIndex, firstVisible: range.firstVisible, total: records.length })
          : action
      }
      {...(isVirtual ? {} : { count: records.length })}
      {...(cursorRow === undefined
        ? {}
        : { activeDescendant: inboxOptionId({ key: cursorRow.key }) })}
      lead={
        lines.length === 0
          ? null
          : lines.map((line) => (
              <ListGridLine
                key={line.key}
                {...(line.onClick === undefined ? {} : { onClick: line.onClick })}
              >
                {line.text}
              </ListGridLine>
            ))
      }
      foot={foot}
    >
      <li ref={anchorRef} role="presentation" aria-hidden className="col-span-full h-0" />
      {span.start > 0 ? (
        <li
          role="presentation"
          aria-hidden
          className="col-span-full"
          style={{ height: span.start * TASK_ROW_HEIGHT }}
        />
      ) : null}
      {rendered.map((record) => (
        <InboxRow
          key={record.key}
          record={record}
          selected={record.key === selectedKey}
          isCursor={record.key === cursorKey}
          onSelect={onSelect}
          onActivate={onActivate}
          isStarred={starOf(record)}
          onToggleStar={onToggleStar}
        />
      ))}
      {span.end < shown.length ? (
        <li
          role="presentation"
          aria-hidden
          className="col-span-full"
          style={{ height: (shown.length - span.end) * TASK_ROW_HEIGHT }}
        />
      ) : null}
    </ListGridGroup>
  );
};
