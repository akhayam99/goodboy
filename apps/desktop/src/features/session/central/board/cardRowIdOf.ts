import type { ActionCardModel } from '../next/actionCardsOf';
import { NO_BRANCH_ROW_ID } from './branchBoardOf';

type Params = {
  readonly card: ActionCardModel;
  readonly rowIds: ReadonlySet<string>;
  readonly looseRowId: string;
};

const BRANCH_VERB_KINDS: ReadonlySet<string> = new Set([
  'rebase-project',
  'rebase',
  'push-branch',
  'open-pr',
  'mark-ready',
  'merge-pr',
  'fix-checks',
  'resolve-threads',
  'fixRun',
]);

export const cardRowIdOf = ({ card, rowIds, looseRowId }: Params): string => {
  if (card.mountId === null) {
    return BRANCH_VERB_KINDS.has(card.kind) ? looseRowId : NO_BRANCH_ROW_ID;
  }
  return rowIds.has(card.mountId) ? card.mountId : looseRowId;
};
