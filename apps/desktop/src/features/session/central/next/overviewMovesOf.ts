import type { ActionCardModel } from './actionCardsOf';

export const NEXT_LIMIT = 3;

type Params = {
  readonly cards: ReadonlyArray<ActionCardModel>;
};

type CardParams = {
  readonly card: ActionCardModel;
};

export type OverviewMoves = Readonly<{
  needsYou: ReadonlyArray<ActionCardModel>;
  next: ReadonlyArray<ActionCardModel>;
  rest: ReadonlyArray<ActionCardModel>;
  shownAskIds: ReadonlySet<string>;
}>;

const askIdsOf = ({ card }: CardParams): ReadonlyArray<string> => {
  const { source } = card;
  if (source.kind === 'owner') {
    return source.owner.questionIds;
  }
  if (source.kind === 'suggestion' && source.suggestion.kind === 'answer-questions') {
    const first = source.suggestion.payload.firstQuestion;
    return first === null ? [] : [first.id];
  }
  return [];
};

export const overviewMovesOf = ({ cards }: Params): OverviewMoves => {
  const needsYou = cards.filter((card) => card.band === 0);
  const others = cards.filter((card) => card.band !== 0);
  const next = others.slice(0, NEXT_LIMIT);
  return {
    needsYou,
    next,
    rest: others.slice(NEXT_LIMIT),
    shownAskIds: new Set([...needsYou, ...next].flatMap((card) => askIdsOf({ card }))),
  };
};
