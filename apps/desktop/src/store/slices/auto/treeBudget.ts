import {
  autoBudgetFacts,
  autoBudgetLabel,
  autoBudgetPromptLine,
  autoTreeSpendOf,
  type AutoBudgetFacts,
} from '@goodboy/core';
import type { Database } from '@goodboy/db';
import type { AutoTreeId } from '@goodboy/types';
import { treeSpend } from './spend';

export type TreeBudget = Readonly<{
  facts: AutoBudgetFacts;
  label: string;
  promptLine: string;
}>;

type TreeBudgetParams = {
  readonly db: Database;
  readonly treeId: AutoTreeId;
  readonly turnReservedUsd?: number;
};

export const treeBudget = async ({
  db,
  treeId,
  turnReservedUsd = 0,
}: TreeBudgetParams): Promise<TreeBudget | null> => {
  const spend = await treeSpend({ db, treeId });
  if (spend === null) {
    return null;
  }
  const facts = autoBudgetFacts({
    spend: autoTreeSpendOf({ ...spend, reservedUsd: spend.reservedUsd + turnReservedUsd }),
  });
  return {
    facts,
    label: autoBudgetLabel({ facts }),
    promptLine: autoBudgetPromptLine({ facts, turnReservedUsd }),
  };
};
