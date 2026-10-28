import { ListFilter } from 'lucide-react';
import { IconButton } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../../shared/components/conceptIcons';
import { ColumnDoorRow } from '../../../SideColumn/ColumnDoorRow';
import { doorSignalOf } from '../../../SideColumn/doorSignal';

const NO_QUIET = { quietCount: 0, quietReasons: [] } as const;

const noop = () => undefined;

type DoorCase = {
  readonly count: number;
  readonly tone: 'warning' | 'danger';
  readonly reasons: ReadonlyArray<string>;
};

const DOOR_CASES: ReadonlyArray<DoorCase> = [
  { count: 1, tone: 'warning', reasons: ['1 question for you'] },
  {
    count: 3,
    tone: 'warning',
    reasons: ['2 questions for you', 'Plan v3 waits for your approval'],
  },
  { count: 12, tone: 'danger', reasons: ['Checks failing'] },
];

export const RailOrderDoorsScene = () => (
  <main className="flex min-h-screen flex-col gap-1 bg-background p-4 text-foreground">
    <div className="flex w-60 flex-col gap-1">
      {DOOR_CASES.map((door) => (
        <ColumnDoorRow
          key={door.count}
          id="board"
          icon={CONCEPT_ICONS.sessions}
          label="Sessions"
          isCurrent={door.count === 3}
          signal={doorSignalOf({ kind: 'board', ...door, ...NO_QUIET })}
          action={
            <IconButton
              icon={ListFilter}
              label="Filter sessions"
              size="xs"
              tooltipSide="right"
              onClick={noop}
            />
          }
          onSelect={noop}
        />
      ))}
    </div>
  </main>
);
