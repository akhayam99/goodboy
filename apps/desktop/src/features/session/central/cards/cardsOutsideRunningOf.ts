import type { ActionCardModel } from '../next/actionCardsOf';
import type { LiveGroupModel } from '../now/liveGroupsOf';

type Params = {
  readonly cards: ReadonlyArray<ActionCardModel>;
  readonly groups: ReadonlyArray<LiveGroupModel>;
};

type CardParams = {
  readonly card: ActionCardModel;
};

const runIdOf = ({ card }: CardParams): string | null => {
  const { source } = card;
  if (source.kind === 'suggestion' && source.suggestion.kind === 'workflow-next-step') {
    return source.suggestion.payload.runId;
  }
  if (source.kind !== 'owner' || source.owner.kind !== 'run') {
    return null;
  }
  const entry = source.owner.item?.entry;
  return entry?.kind === 'run' ? entry.run.id : null;
};

export const cardsOutsideRunningOf = ({
  cards,
  groups,
}: Params): ReadonlyArray<ActionCardModel> => {
  const runningRunIds = new Set<string>(
    groups.flatMap((group) =>
      group.kind === 'run' || group.kind === 'orchestrated' ? [group.entry.run.id] : [],
    ),
  );
  return cards.filter((card) => {
    const runId = runIdOf({ card });
    return runId === null || !runningRunIds.has(runId);
  });
};
