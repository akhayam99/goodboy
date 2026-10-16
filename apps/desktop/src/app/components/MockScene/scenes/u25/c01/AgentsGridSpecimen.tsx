import { useState } from 'react';
import { ListGrid, ListGridRow, StateDot, type DotState, type ListGridColumn } from '@goodboy/ui';

const COLUMNS: ReadonlyArray<ListGridColumn> = [
  { key: 'state', width: 16 },
  { key: 'role', width: 96 },
  { key: 'title', width: 'fill', isTitle: true },
  { key: 'word', width: 96 },
  { key: 'model', width: 144 },
  { key: 'time', width: 56, align: 'end', isNumeric: true, tone: 'hint' },
];

type AgentRow = {
  readonly id: string;
  readonly state: DotState;
  readonly word: string;
  readonly role: string;
  readonly title: string;
  readonly model: string;
  readonly time: string;
};

const AGENTS: ReadonlyArray<AgentRow> = [
  {
    id: 'implementer',
    state: 'running',
    word: 'Working',
    role: 'Implementer',
    title: 'Stream ledger rows to CSV in payments-api',
    model: 'Opus 5.5',
    time: '1:12',
  },
  {
    id: 'scout',
    state: 'done',
    word: 'Done',
    role: 'Scout',
    title: 'Find every caller of exportLedger',
    model: 'Sonnet 5.5',
    time: '4:05',
  },
  {
    id: 'ci-fixer',
    state: 'failed',
    word: 'Failed',
    role: 'CI fixer',
    title: 'Fix the flaky retry test in notify-relay',
    model: 'Opus 5.5',
    time: '12:40',
  },
  {
    id: 'reviewer',
    state: 'needsYou',
    word: 'Needs you',
    role: 'Reviewer',
    title: 'Review the Northwind webhook retries branch',
    model: 'Sonnet 5.5',
    time: '0:38',
  },
];

export const AgentsGridSpecimen = () => {
  const [selected, setSelected] = useState('implementer');
  return (
    <ListGrid label="Agents" columns={COLUMNS}>
      {AGENTS.map((agent) => (
        <ListGridRow
          key={agent.id}
          isSelected={agent.id === selected}
          onSelect={() => setSelected(agent.id)}
          cells={[
            <StateDot key="dot" state={agent.state} label={agent.word} />,
            agent.role,
            agent.title,
            agent.word,
            agent.model,
            agent.time,
          ]}
        />
      ))}
    </ListGrid>
  );
};
