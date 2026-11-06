import type { AgentId, TurnState } from '@goodboy/types';
import type { AutoTreeView } from '../../../store/slices/auto-view/state';
import { autoGlanceOf } from '../../auto/glance/autoGlanceOf';
import type { Glance } from '../glance/glanceOf';
import type { ActionCardModel } from './next/actionCardsOf';

type Params = {
  readonly views: ReadonlyArray<AutoTreeView>;
  readonly rootTurns: ReadonlyArray<TurnState | null | undefined>;
  readonly cards: ReadonlyArray<ActionCardModel>;
};

const autoRootsOf = ({ cards }: Pick<Params, 'cards'>): ReadonlySet<AgentId> =>
  new Set(
    cards.flatMap((card): ReadonlyArray<AgentId> => [
      ...(card.source.kind === 'auto' ? [card.source.target.rootAgentId] : []),
      ...card.folded.flatMap((folded) =>
        folded.source.kind === 'auto' ? [folded.source.target.rootAgentId] : [],
      ),
    ]),
  );

export const autoGlancesBesideCardsOf = ({
  views,
  rootTurns,
  cards,
}: Params): ReadonlyArray<Glance> => {
  const roots = autoRootsOf({ cards });
  return views.flatMap((view, index) =>
    roots.has(view.tree.rootAgentId)
      ? []
      : [autoGlanceOf({ view, rootTurn: rootTurns[index] ?? null })],
  );
};
