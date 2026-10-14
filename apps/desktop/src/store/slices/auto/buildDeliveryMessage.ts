import { buildArtifactLedgerBlock, buildDeliveryText } from '@goodboy/core';
import type { AutoOutboxRow, AutoTree, Database } from '@goodboy/db';
import { treeArtifacts } from './treeArtifacts';
import { treeBudget } from './treeBudget';

export type BuildDeliveryMessageParams = Readonly<{
  db: Database;
  tree: AutoTree;
  rows: ReadonlyArray<AutoOutboxRow>;
  nowMs: number;
}>;

type RestartMarkParams = {
  readonly payload: unknown;
};

const isRestartPayload = ({ payload }: RestartMarkParams): boolean =>
  typeof payload === 'object' &&
  payload !== null &&
  'restartOf' in payload &&
  typeof payload.restartOf === 'string';

export const buildDeliveryMessage = async ({
  db,
  tree,
  rows,
  nowMs,
}: BuildDeliveryMessageParams): Promise<string> => {
  const entries = await treeArtifacts({ db, treeId: tree.id });
  const budget = await treeBudget({ db, treeId: tree.id });
  return buildDeliveryText({
    ledgerBlock: buildArtifactLedgerBlock({ entries, nowMs, generation: tree.generation }),
    budgetLine: budget === null ? '' : budget.promptLine,
    rows: rows.map((row) => ({ id: row.id, payload: row.payload })),
    isRestart: rows.some((row) => isRestartPayload({ payload: row.payload })),
  });
};
