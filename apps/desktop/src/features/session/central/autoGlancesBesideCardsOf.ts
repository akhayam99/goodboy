import type { TurnState } from '@goodboy/types';
import type { AutoTreeView } from '../../../store/slices/auto-view/state';
import { autoGlanceOf } from '../../auto/glance/autoGlanceOf';
import type { Glance } from '../glance/glanceOf';
import { cardedAutoRootsOf } from './cardedAutoRootsOf';
import type { ActionCardModel } from './next/actionCardsOf';

type Params = {
  readonly views: ReadonlyArray<AutoTreeView>;
  readonly rootTurns: ReadonlyArray<TurnState | null | undefined>;
  readonly cards: ReadonlyArray<ActionCardModel>;
};

export const autoGlancesBesideCardsOf = ({
  views,
  rootTurns,
  cards,
}: Params): ReadonlyArray<Glance> => {
  const roots = cardedAutoRootsOf({ cards });
  return views.flatMap((view, index) =>
    roots.has(view.tree.rootAgentId)
      ? []
      : [autoGlanceOf({ view, rootTurn: rootTurns[index] ?? null })],
  );
};
