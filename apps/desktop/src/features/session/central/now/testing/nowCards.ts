import type { NextStepBand } from '../../../../suggestions/types';
import type { ActionCardModel, AutoActionTarget } from '../../next/actionCardsOf';
import type { NeedsYouOwner } from '../../../timeline/needsYou';

type QuestionParams = {
  readonly where: string | null;
};

export const aQuestionCard = ({ where }: QuestionParams): ActionCardModel => {
  const owner: NeedsYouOwner = {
    id: 'question-1',
    kind: 'question',
    text: 'Cap per day or per payout?',
    where,
    at: null,
    item: null,
    question: null,
    questionIds: ['question-1'],
    prNumber: null,
    owed: null,
    mountId: null,
  };
  return {
    id: 'owner:question-1',
    band: 0,
    priority: 0,
    kind: 'question',
    title: owner.text,
    detail: where,
    mountId: null,
    source: { kind: 'owner', owner },
    folded: [],
  };
};

type AutoParams = {
  readonly target: AutoActionTarget;
};

export const anAutoCard = ({ target }: AutoParams): ActionCardModel => ({
  id: `auto:${target.agentId}:${target.kind}`,
  band: 0,
  priority: 0,
  kind: target.kind,
  title: 'Auto is stuck',
  detail: `"${target.role}" never started.`,
  mountId: null,
  source: { kind: 'auto', target },
  folded: [],
});

type BandParams = {
  readonly band: NextStepBand;
  readonly base: ActionCardModel;
};

export const inBand = ({ band, base }: BandParams): ActionCardModel => ({ ...base, band });
