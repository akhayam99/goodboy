import {
  CountBadge,
  EmptyLine,
  ListGrid,
  ListGridRow,
  StatusDot,
  type ListGridColumn,
} from '@goodboy/ui';
import type { CalendarRow } from '../../calendarRowsOf';
import type { SelectEventParams } from '../../calendarView';

type Props = {
  readonly rows: ReadonlyArray<CalendarRow>;
  readonly needsYouCount: number;
  readonly selectedId: string | null;
  readonly onSelect: (params: SelectEventParams) => void;
};

const COLUMNS: ReadonlyArray<ListGridColumn> = [
  { key: 'mark', width: 16 },
  { key: 'start', width: 48, isNumeric: true, tone: 'hint' },
  { key: 'title', width: 'fill', isTitle: true },
  { key: 'length', width: 56, align: 'end', isNumeric: true, tone: 'hint' },
  { key: 'state', width: 64, isNumeric: true, shouldHideWhenEmpty: true },
  { key: 'needs', width: 16, shouldHideWhenEmpty: true },
];

type StateParams = {
  readonly row: CalendarRow;
};

const stateCellOf = ({ row }: StateParams) => {
  if (row.state === null) {
    return null;
  }
  if (row.isEnded) {
    return <span className="text-faint-foreground">{row.state}</span>;
  }
  return <span className="text-info">{row.state}</span>;
};

type AriaParams = {
  readonly row: CalendarRow;
  readonly badge: number;
};

const ariaLabelOf = ({ row, badge }: AriaParams): string =>
  [row.start, row.title, row.length, row.state, badge > 0 ? `${badge} need you` : null]
    .filter((part): part is string => part !== null && part !== '')
    .join(', ');

export const CalendarToday = ({ rows, needsYouCount, selectedId, onSelect }: Props) => {
  if (rows.length === 0) {
    return <EmptyLine>Nothing today</EmptyLine>;
  }
  return (
    <ListGrid label="Today" columns={COLUMNS}>
      {rows.map((row) => {
        const badge = row.isCallSoon ? needsYouCount : 0;
        return (
          <ListGridRow
            key={row.id}
            rowKey={row.id}
            ariaLabel={ariaLabelOf({ row, badge })}
            isSelected={selectedId === row.id}
            onSelect={() => onSelect({ id: row.id })}
            cells={{
              byKey: {
                mark: <StatusDot tone="neutral" color={row.color} />,
                start: row.start,
                title: row.title,
                length: row.length,
                state: stateCellOf({ row }),
                needs:
                  badge > 0 ? (
                    <CountBadge count={badge} tone="warning" isAnnounced={false} />
                  ) : null,
              },
            }}
          />
        );
      })}
    </ListGrid>
  );
};
