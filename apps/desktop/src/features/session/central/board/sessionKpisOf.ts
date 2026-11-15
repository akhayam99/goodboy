import type { BranchBoard } from './boardTypes';

export type SessionKpis = Readonly<{
  branches: Readonly<{ merged: number; total: number }>;
  needsYou: Readonly<{ askCount: number }>;
  spendUsd: number;
  elapsedMs: number;
  leadCount: number;
  agentCount: number;
}>;

type Params = {
  readonly board: BranchBoard;
};

export const sessionKpisOf = ({ board }: Params): SessionKpis => {
  const { rows } = board;
  const branchRows = rows.filter((row) => row.mountId !== null);
  return {
    branches: {
      merged: branchRows.filter((row) => row.isMerged).length,
      total: branchRows.length,
    },
    needsYou: {
      askCount: new Set(rows.flatMap((row) => row.askIds)).size,
    },
    spendUsd: rows.reduce((sum, row) => sum + row.spendUsd, 0),
    elapsedMs: rows.reduce((sum, row) => sum + row.elapsedMs, 0),
    leadCount: new Set(rows.flatMap((row) => row.leadIds)).size,
    agentCount: new Set(rows.flatMap((row) => row.agentIds)).size,
  };
};
