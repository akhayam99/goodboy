import type { ActionCardModel } from '../next/actionCardsOf';
import type { LiveGroupModel } from './liveGroupsOf';
import { liveSectionIdOf } from './liveSectionIdOf';

type Params = {
  readonly groups: ReadonlyArray<LiveGroupModel>;
  readonly cards?: ReadonlyArray<ActionCardModel>;
};

type CardParams = {
  readonly card: ActionCardModel;
};

type GroupParams = {
  readonly group: LiveGroupModel;
};

const askedSubjectOf = ({ card }: CardParams): string | null => {
  const { source } = card;
  if (source.kind !== 'owner') {
    return null;
  }
  const entry = source.owner.item?.entry;
  if (entry?.kind === 'agent') {
    return `agent:${entry.agent.id}`;
  }
  return entry?.kind === 'run' ? `run:${entry.run.id}` : null;
};

const liveSubjectOf = ({ group }: GroupParams): string | null => {
  if (group.kind === 'agent') {
    return `agent:${group.entry.agent.id}`;
  }
  return group.kind === 'auto' ? null : `run:${group.entry.run.id}`;
};

export const waitingGroupsOf = ({ groups, cards = [] }: Params): ReadonlyArray<LiveGroupModel> => {
  const asked = new Set(cards.flatMap((card) => askedSubjectOf({ card }) ?? []));
  return groups
    .filter((group) => liveSectionIdOf({ group }) === 'needs-you')
    .filter((group) => {
      const subject = liveSubjectOf({ group });
      return subject === null || !asked.has(subject);
    })
    .sort((first, second) => first.startedAt - second.startedAt);
};
