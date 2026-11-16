import { brandId, type OpenQuestionId } from '@goodboy/types';
import type { ActionCardModel } from '../next/actionCardsOf';
import type { BoardRow } from './boardTypes';

type Params = {
  readonly row: BoardRow;
  readonly cards: ReadonlyArray<Pick<ActionCardModel, 'kind'>>;
};

export type BoardTileAction =
  | { readonly kind: 'none' }
  | { readonly kind: 'card'; readonly index: number }
  | { readonly kind: 'question'; readonly questionId: OpenQuestionId };

const ANSWER_KINDS: ReadonlySet<string> = new Set(['question', 'answer-questions']);

export const boardTileActionOf = ({ row, cards }: Params): BoardTileAction => {
  if (row.isMerged) {
    return { kind: 'none' };
  }
  const [askId] = row.askIds;
  if (askId !== undefined) {
    const answerIndex = cards.findIndex((card) => ANSWER_KINDS.has(card.kind));
    return answerIndex >= 0
      ? { kind: 'card', index: answerIndex }
      : { kind: 'question', questionId: brandId<OpenQuestionId>({ value: askId }) };
  }
  return cards.length > 0 ? { kind: 'card', index: 0 } : { kind: 'none' };
};
