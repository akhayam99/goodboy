import type { AutoStuckKind } from '../../../../../../features/auto/autoStuckKindOf';
import {
  actionCardsOf,
  type ActionCardModel,
} from '../../../../../../features/session/central/next/actionCardsOf';
import { NEXT_LIST_SOURCES } from './nextListSources';

const VERB_ON_0279: Readonly<Record<AutoStuckKind, string>> = {
  neverStarted: 'never started',
  failed: 'stopped',
  timedOut: 'timed out',
  childBlocked: 'is blocked',
};

type CardParams = {
  readonly card: ActionCardModel;
};

const detailOn0279 = ({ card }: CardParams): string | null => {
  const { source } = card;
  if (source.kind !== 'auto') {
    return card.detail;
  }
  const { target } = source;
  if (target.kind === 'approve' || target.kind === 'blocked') {
    return target.reason;
  }
  const line = `"${target.role}" ${VERB_ON_0279[target.kind]}.`;
  return target.reason === null ? line : `${line} ${target.reason}`;
};

export const NEXT_LIST_BEFORE_CARDS: ReadonlyArray<ActionCardModel> = actionCardsOf(
  NEXT_LIST_SOURCES,
).map((card) => ({ ...card, detail: detailOn0279({ card }) }));
