import type { AgentId } from '@goodboy/types';
import type { ActionCardModel } from '../../central/next/actionCardsOf';
import { nextRowsOf } from '../../central/next/nextRowsOf';

type OpenParams = {
  readonly card: ActionCardModel;
};

type Params = {
  readonly cards: ReadonlyArray<ActionCardModel>;
  readonly agentId: AgentId;
  readonly canOpen: (params: OpenParams) => boolean;
};

export type DockNext = Readonly<{
  card: ActionCardModel;
  moreCount: number;
}>;

type CardParams = {
  readonly card: ActionCardModel;
  readonly agentId: AgentId;
};

const isThisAgents = ({ card, agentId }: CardParams): boolean => {
  const { source } = card;
  if (source.kind === 'auto') {
    return source.target.agentId === agentId || source.target.rootAgentId === agentId;
  }
  if (source.kind === 'owner') {
    const { question, item } = source.owner;
    const entry = item?.entry;
    return (
      question?.createdByAgentId === agentId ||
      (entry !== undefined && 'agent' in entry && entry.agent.id === agentId)
    );
  }
  return false;
};

export const dockNextOf = ({ cards, agentId, canOpen }: Params): DockNext | null => {
  const rows = nextRowsOf({ cards }).filter(
    (card) => card.band === 0 && !isThisAgents({ card, agentId }) && canOpen({ card }),
  );
  const [first, ...rest] = rows;
  return first === undefined ? null : { card: first, moreCount: rest.length };
};
