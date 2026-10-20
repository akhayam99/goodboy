import type { AutoTreeView } from '../../../../store/slices/auto-view/state';
import { autoStuckKindOf } from '../../../auto/autoStuckKindOf';
import type { ActionCardModel } from '../next/actionCardsOf';
import type { LiveAutoGroup, LiveGroupModel } from './liveGroupsOf';

export type StuckAuto = Readonly<{
  group: LiveAutoGroup;
  card: ActionCardModel | null;
  view: AutoTreeView | null;
}>;

type Params = {
  readonly groups: ReadonlyArray<LiveGroupModel>;
  readonly cards: ReadonlyArray<ActionCardModel>;
  readonly views: ReadonlyArray<AutoTreeView>;
};

export const stuckAutoOf = ({ groups, cards, views }: Params): StuckAuto | null => {
  const group = groups.find(
    (candidate): candidate is LiveAutoGroup =>
      candidate.kind === 'auto' && candidate.state === 'stuck',
  );
  if (group === undefined) {
    return null;
  }
  const rootAgentId = group.group.rootAgentId;
  const child = group.children.find(({ state }) => autoStuckKindOf({ state }) !== null);
  const card =
    cards.find(
      (candidate) =>
        candidate.source.kind === 'auto' &&
        candidate.source.target.rootAgentId === rootAgentId &&
        candidate.source.target.agentId === child?.agentId,
    ) ?? null;
  const view = views.find((candidate) => candidate.tree.rootAgentId === rootAgentId) ?? null;
  return { group, card, view };
};
