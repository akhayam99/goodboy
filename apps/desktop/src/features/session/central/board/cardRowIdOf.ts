import type { ActionCardModel } from '../next/actionCardsOf';
import { NO_BRANCH_ROW_ID } from './branchBoardOf';

type Params = {
  readonly card: ActionCardModel;
  readonly rowIds: ReadonlySet<string>;
  readonly looseRowId: string;
  readonly rowIdByAskId?: ReadonlyMap<string, string>;
};

type CardParams = {
  readonly card: ActionCardModel;
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

const NO_ASKS: ReadonlyMap<string, string> = new Map();

const questionIdsOf = ({ card }: CardParams): ReadonlyArray<string> => {
  if (card.source.kind === 'owner') {
    return card.source.owner.questionIds;
  }
  if (card.source.kind === 'suggestion' && card.source.suggestion.kind === 'answer-questions') {
    const first = card.source.suggestion.payload.firstQuestion;
    return first === null ? [] : [first.id];
  }
  return [];
};

export const cardRowIdOf = ({
  card,
  rowIds,
  looseRowId,
  rowIdByAskId = NO_ASKS,
}: Params): string => {
  if (card.mountId === null) {
    const askRowId = questionIdsOf({ card })
      .map((questionId) => rowIdByAskId.get(questionId))
      .find((rowId) => rowId !== undefined && rowIds.has(rowId));
    if (askRowId !== undefined) {
      return askRowId;
    }
    return BRANCH_VERB_KINDS.has(card.kind) ? looseRowId : NO_BRANCH_ROW_ID;
  }
  return rowIds.has(card.mountId) ? card.mountId : looseRowId;
};
