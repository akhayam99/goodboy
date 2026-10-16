import {
  autoBudgetOf,
  autoBudgetLabel,
  autoBudgetPromptLine,
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
};

export const treeBudget = async ({ db, treeId }: TreeBudgetParams): Promise<TreeBudget | null> => {
  const spend = await treeSpend({ db, treeId });
  if (spend === null) {
    return null;
  }
  const facts = autoBudgetOf({ spend });
  return {
    facts,
    label: autoBudgetLabel({ facts }),
    promptLine: autoBudgetPromptLine({ facts }),
  };
};
