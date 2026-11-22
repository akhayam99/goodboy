import { brandId, type OpenQuestionId } from '@goodboy/types';
import type { ActionCardModel } from '../next/actionCardsOf';
import type { BoardRow } from './boardTypes';

type Params = {
  readonly row: BoardRow;
  readonly cards: ReadonlyArray<Pick<ActionCardModel, 'kind'>>;
  readonly shownAskIds: ReadonlySet<string>;
};

type BoardTileAction =
  | { readonly kind: 'none' }
  | { readonly kind: 'card'; readonly index: number }
  | { readonly kind: 'question'; readonly questionId: OpenQuestionId }
  | { readonly kind: 'remove'; readonly mountId: string };

const ANSWER_KINDS: ReadonlySet<string> = new Set(['question', 'answer-questions']);

export const boardTileActionOf = ({ row, cards, shownAskIds }: Params): BoardTileAction => {
  if (row.isClosed) {
    return { kind: 'none' };
  }
  if (row.isMerged) {
    return row.mountId === null ? { kind: 'none' } : { kind: 'remove', mountId: row.mountId };
  }
  if (row.askIds.length > 0) {
    const answerIndex = cards.findIndex((card) => ANSWER_KINDS.has(card.kind));
    if (answerIndex >= 0) {
      return { kind: 'card', index: answerIndex };
    }
    const askId = row.askIds.find((id) => !shownAskIds.has(id));
    if (askId !== undefined) {
      return { kind: 'question', questionId: brandId<OpenQuestionId>({ value: askId }) };
    }
  }
  return cards.length > 0 ? { kind: 'card', index: 0 } : { kind: 'none' };
};
