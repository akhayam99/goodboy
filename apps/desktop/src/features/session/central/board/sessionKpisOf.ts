import type { BranchBoard } from './boardTypes';

export type SessionKpis = Readonly<{
  branches: Readonly<{ merged: number; total: number }>;
  needsYou: Readonly<{ count: number; askCount: number }>;
  checks: Readonly<{ passing: number; failing: number; running: number; total: number }>;
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
  const checked = rows.filter((row) => row.checks !== null);
  return {
    branches: {
      merged: branchRows.filter((row) => row.isMerged).length,
      total: branchRows.length,
    },
    needsYou: {
      count: new Set(rows.flatMap((row) => row.needsYouIds)).size,
      askCount: new Set(rows.flatMap((row) => row.askIds)).size,
    },
    checks: {
      passing: checked.filter((row) => row.checks === 'success').length,
      failing: checked.filter((row) => row.checks === 'failure').length,
      running: checked.filter((row) => row.checks === 'pending').length,
      total: checked.length,
    },
    spendUsd: rows.reduce((sum, row) => sum + row.spendUsd, 0),
    elapsedMs: rows.reduce((sum, row) => sum + row.elapsedMs, 0),
    leadCount: new Set(rows.flatMap((row) => row.leadIds)).size,
    agentCount: new Set(rows.flatMap((row) => row.agentIds)).size,
  };
};
