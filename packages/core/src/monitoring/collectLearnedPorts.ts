import type { LearnedPorts, PortRow } from './types';

type Params = {
  readonly rows: ReadonlyArray<PortRow>;
  readonly learned: LearnedPorts;
};

export const collectLearnedPorts = ({ rows, learned }: Params): LearnedPorts => {
  let current: LearnedPorts = learned;
  for (const row of rows) {
    if (row.state !== 'listening' || row.owner === null || row.projectId === null) {
      continue;
    }
    const isGoodboyOwned =
      row.owner.kind === 'script' || row.owner.kind === 'terminal' || row.owner.kind === 'agent';
    const known: ReadonlyArray<number> = current[row.projectId] ?? [];
    if (!isGoodboyOwned || known.includes(row.port)) {
      continue;
    }
    current = { ...current, [row.projectId]: [...known, row.port].sort((a, b) => a - b) };
  }
  return current;
};
