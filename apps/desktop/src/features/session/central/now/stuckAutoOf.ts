import type { AutoTreeView } from '../../../../store/slices/auto-view/state';
import type { LiveAutoGroup, LiveGroupModel } from './liveGroupsOf';

export type StuckAuto = Readonly<{
  group: LiveAutoGroup;
  view: AutoTreeView | null;
}>;

type Params = {
  readonly groups: ReadonlyArray<LiveGroupModel>;
  readonly views: ReadonlyArray<AutoTreeView>;
};

export const stuckAutoOf = ({ groups, views }: Params): StuckAuto | null => {
  const group = groups.find(
    (candidate): candidate is LiveAutoGroup =>
      candidate.kind === 'auto' && candidate.state === 'stuck',
  );
  if (group === undefined) {
    return null;
  }
  const rootAgentId = group.group.rootAgentId;
  const view = views.find((candidate) => candidate.tree.rootAgentId === rootAgentId) ?? null;
  return { group, view };
};
