import {
  ListGrid,
  ListGridGroup,
  ListGridRow,
  StateDot,
  type DotState,
  type ListGridColumn,
} from '@goodboy/ui';

const COLUMNS: ReadonlyArray<ListGridColumn> = [
  { key: 'state', width: 16 },
  { key: 'key', width: 72, tone: 'hint' },
  { key: 'title', width: 'fill', isTitle: true },
  { key: 'updated', width: 48, align: 'end', isNumeric: true, tone: 'hint' },
];

type TaskRow = {
  readonly key: string;
  readonly title: string;
  readonly updated: string;
  readonly state: DotState;
};

type TaskGroup = {
  readonly label: string;
  readonly count: number;
  readonly rows: ReadonlyArray<TaskRow>;
};

const GROUPS: ReadonlyArray<TaskGroup> = [
  {
    label: 'In progress',
    count: 2,
    rows: [
      {
        key: 'HBL-412',
        title: 'Ledger export times out over 10k rows',
        updated: '2h',
        state: 'running',
      },
      { key: 'HBL-398', title: 'Retry failed ledger syncs', updated: '1d', state: 'needsYou' },
    ],
  },
  {
    label: 'Todo',
    count: 14,
    rows: [
      {
        key: 'NWD-77',
        title: 'Northwind webhook retries drop the last event',
        updated: '3d',
        state: 'idle',
      },
      {
        key: 'ACM-12',
        title: 'Acme invoices show the wrong currency',
        updated: '5d',
        state: 'idle',
      },
    ],
  },
];

export const TasksGridSpecimen = () => (
  <ListGrid label="Tasks" columns={COLUMNS} isGrouped>
    {GROUPS.map((group) => (
      <ListGridGroup
        key={group.label}
        label={group.label}
        count={group.count}
        {...(group.count > group.rows.length && {
          fold: { label: 'Show all', onToggle: () => undefined },
        })}
      >
        {group.rows.map((row) => (
          <ListGridRow
            key={row.key}
            onSelect={() => undefined}
            cells={[
              <StateDot key="dot" state={row.state} label={group.label} isLive />,
              row.key,
              row.title,
              row.updated,
            ]}
          />
        ))}
      </ListGridGroup>
    ))}
  </ListGrid>
);
