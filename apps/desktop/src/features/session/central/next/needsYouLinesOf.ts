import { joinFacts } from '../../../../shared/utils/joinFacts';
import { formatAge } from '../../../../shared/utils/time/formatAge';
import type { ActionCardModel } from './actionCardsOf';

type Params = {
  readonly card: ActionCardModel;
  readonly project: string | null;
  readonly now: number;
};

export type NeedsYouLines = {
  readonly title: string;
  readonly meta: string;
};

const LEAD = 'Lead';

const STUCK_KINDS: ReadonlySet<string> = new Set(['neverStarted', 'failed', 'timedOut']);

const whoOf = ({ card }: Pick<Params, 'card'>): string | null => {
  if (card.source.kind === 'auto') {
    return LEAD;
  }
  return card.source.kind === 'owner' && card.source.owner.kind === 'question' ? 'Question' : null;
};

const ageOf = ({ card, now }: Pick<Params, 'card' | 'now'>): string | null =>
  card.source.kind === 'owner' && card.source.owner.at !== null
    ? formatAge({ from: card.source.owner.at, now })
    : null;

export const needsYouLinesOf = ({ card, project, now }: Params): NeedsYouLines => {
  const why = card.reason ?? card.detail;
  const hasWhy = why !== null && why !== '';
  const isStuck = card.source.kind === 'auto' && STUCK_KINDS.has(card.kind);
  const title = isStuck && hasWhy ? why : card.title;
  const aside = isStuck || !hasWhy ? null : why;
  return {
    title,
    meta: joinFacts({ facts: [whoOf({ card }), aside, project, ageOf({ card, now })] }),
  };
};
