import type { BoardAgent, BoardLead, BoardRow } from './boardTypes';
import { NO_BRANCH_ROW_ID } from './branchBoardOf';

type Params = {
  readonly rows: ReadonlyArray<BoardRow>;
  readonly agents: ReadonlyArray<BoardAgent>;
  readonly leads: ReadonlyArray<BoardLead>;
};

export const runningByRowIdOf = ({ rows, agents, leads }: Params): ReadonlyMap<string, number> => {
  const known = new Set<string>(rows.map((row) => row.id));
  const byRow = new Map<string, number>();
  const running = [
    ...agents.filter((agent) => agent.isRunning).map((agent) => agent.mountId),
    ...leads.filter((lead) => lead.isRunning).map((lead) => lead.primaryMountId),
  ];
  for (const mountId of running) {
    const key = mountId !== null && known.has(mountId) ? mountId : NO_BRANCH_ROW_ID;
    byRow.set(key, (byRow.get(key) ?? 0) + 1);
  }
  return byRow;
};
