import type { AgentId } from '@goodboy/types';
import type { ActionCardModel } from './next/actionCardsOf';

type Params = {
  readonly cards: ReadonlyArray<ActionCardModel>;
};

export const cardedAutoRootsOf = ({ cards }: Params): ReadonlySet<AgentId> =>
  new Set(
    cards.flatMap((card): ReadonlyArray<AgentId> => [
      ...(card.source.kind === 'auto' ? [card.source.target.rootAgentId] : []),
      ...card.folded.flatMap((folded) =>
        folded.source.kind === 'auto' ? [folded.source.target.rootAgentId] : [],
      ),
    ]),
  );
