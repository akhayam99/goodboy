import { ListGrid, ListGridRow, StateDot, type DotState, type ListGridColumn } from '@goodboy/ui';

const COLUMNS: ReadonlyArray<ListGridColumn> = [
  { key: 'dot', width: 16 },
  { key: 'word', width: 'fill', isTitle: true },
];

type DotRow = {
  readonly state: DotState;
  readonly label: string;
};

const DOTS: ReadonlyArray<DotRow> = [
  { state: 'running', label: 'Something runs' },
  { state: 'needsYou', label: 'Needs you' },
  { state: 'failed', label: 'Failed' },
  { state: 'unread', label: 'Unread' },
  { state: 'done', label: 'Done' },
  { state: 'idle', label: 'Not started' },
];

export const DotsGridSpecimen = () => (
  <ListGrid label="States" columns={COLUMNS}>
    {DOTS.map((dot) => (
      <ListGridRow
        key={dot.state}
        cells={[<StateDot key="dot" state={dot.state} label={dot.label} isLive />, dot.label]}
      />
    ))}
  </ListGrid>
);
