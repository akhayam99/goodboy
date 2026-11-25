import type { BoardAgent, BoardLead, BoardRow } from './boardTypes';
import { NO_BRANCH_ROW_ID } from './branchBoardOf';

type Params = {
  readonly rows: ReadonlyArray<BoardRow>;
  readonly agents: ReadonlyArray<BoardAgent>;
  readonly leads: ReadonlyArray<BoardLead>;
  readonly touchedMountIds?: ReadonlyMap<string, ReadonlyArray<string>>;
};

const NO_TOUCHED: ReadonlyMap<string, ReadonlyArray<string>> = new Map();

export const runningByRowIdOf = ({
  rows,
  agents,
  leads,
  touchedMountIds = NO_TOUCHED,
}: Params): ReadonlyMap<string, number> => {
  const known = new Set<string>(rows.map((row) => row.id));
  const byRow = new Map<string, number>();
  const running: ReadonlyArray<ReadonlyArray<string | null>> = [
    ...agents
      .filter((agent) => agent.isRunning)
      .map((agent) => [agent.mountId, ...(touchedMountIds.get(agent.id) ?? [])]),
    ...leads.filter((lead) => lead.isRunning).map((lead) => [lead.primaryMountId]),
  ];
  for (const mountIds of running) {
    const keys = new Set<string>(
      mountIds.flatMap((mountId) => (mountId !== null && known.has(mountId) ? [mountId] : [])),
    );
    if (keys.size === 0) {
      keys.add(NO_BRANCH_ROW_ID);
    }
    for (const key of keys) {
      byRow.set(key, (byRow.get(key) ?? 0) + 1);
    }
  }
  return byRow;
};
