import type { ActionCardModel } from './actionCardsOf';
import { nextKindFactsOf } from './nextKindFactsOf';
import { nextSubjectOf } from './nextSubjectOf';
import { planSentenceOf } from './planSentenceOf';

type Params = {
  readonly cards: ReadonlyArray<ActionCardModel>;
};

type DetailParams = {
  readonly detail: string | null;
  readonly more: string;
};

const withMoreOf = ({ detail, more }: DetailParams): string => {
  if (detail === null || detail === '') {
    return `And ${more}`;
  }
  return detail.endsWith('.') ? `${detail.slice(0, -1)}, and ${more}.` : `${detail}, and ${more}`;
};

type MembersParams = {
  readonly members: ReadonlyArray<ActionCardModel>;
};

type CardParams = {
  readonly card: ActionCardModel;
};

const questionCountOf = ({ card }: CardParams): number => {
  const { source } = card;
  return source.kind === 'suggestion' && source.suggestion.kind === 'answer-questions'
    ? source.suggestion.payload.count
    : 0;
};

type LeadParams = MembersParams & {
  readonly lead: ActionCardModel;
};

const detailOf = ({ lead, members }: LeadParams): string => {
  const questions = members.reduce((sum, card) => sum + questionCountOf({ card }), 0);
  const others = members.filter((card) => questionCountOf({ card }) === 0).length;
  const { source } = lead;
  if (source.kind === 'auto' && source.target.kind === 'approve') {
    const sentence = planSentenceOf({ plan: source.target.plan, questionCount: questions });
    return others > 0 ? `${sentence} And ${others} more.` : sentence;
  }
  const parts = [
    ...(questions > 0 ? [`${questions} ${questions === 1 ? 'question' : 'questions'}`] : []),
    ...(others > 0 ? [`${others} more`] : []),
  ];
  return withMoreOf({ detail: lead.detail, more: parts.join(' and ') });
};

const rowOf = ({ members }: MembersParams): ActionCardModel | null => {
  const ranked = [...members].sort(
    (first, second) =>
      nextKindFactsOf({ card: first }).rank - nextKindFactsOf({ card: second }).rank,
  );
  const [lead, ...rest] = ranked;
  if (lead === undefined || rest.length === 0) {
    return lead ?? null;
  }
  return {
    ...lead,
    detail: detailOf({ lead, members: rest }),
    folded: [...lead.folded, ...rest.flatMap((card) => [card, ...card.folded])],
  };
};

export const nextRowsOf = ({ cards }: Params): ReadonlyArray<ActionCardModel> => {
  const members = new Map<string, Array<ActionCardModel>>();
  for (const card of cards) {
    const key = `${nextKindFactsOf({ card }).group}|${nextSubjectOf({ card }).key}`;
    const list = members.get(key);
    if (list === undefined) {
      members.set(key, [card]);
      continue;
    }
    list.push(card);
  }
  return Array.from(members.values()).flatMap((list) => {
    const row = rowOf({ members: list });
    return row === null ? [] : [row];
  });
};
