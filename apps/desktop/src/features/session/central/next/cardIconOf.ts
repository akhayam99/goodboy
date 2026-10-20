import type { LucideIcon } from 'lucide-react';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { SUGGESTION_ICONS } from '../../../suggestions/suggestionIcons';
import type { NeedsYouOwnerKind } from '../../timeline/needsYou';
import type { ActionCardModel } from './actionCardsOf';

const OWNER_ICONS: Readonly<Record<NeedsYouOwnerKind, LucideIcon>> = {
  fixRun: CONCEPT_ICONS.comments,
  run: CONCEPT_ICONS.workflows,
  agent: CONCEPT_ICONS.agents,
  question: CONCEPT_ICONS.questions,
  rebase: CONCEPT_ICONS.branch,
};

type Params = {
  readonly card: ActionCardModel;
};

export const cardIconOf = ({ card }: Params): LucideIcon => {
  const { source } = card;
  switch (source.kind) {
    case 'owner':
      return OWNER_ICONS[source.owner.kind];
    case 'suggestion':
      return SUGGESTION_ICONS[source.suggestion.kind];
    case 'auto':
      return CONCEPT_ICONS.auto;
    default: {
      const exhaustive: never = source;
      return exhaustive;
    }
  }
};
