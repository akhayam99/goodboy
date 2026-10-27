import { useMemo, useRef } from 'react';
import type { Agent } from '@goodboy/types';
import { keepEqualById } from '../../../../../shared/utils/keepEqualById';
import type { SessionWorkModel } from '../../useSessionWorkModel';
import { liveGroupsOf, type LiveGroupModel } from '../liveGroupsOf';

type Params = {
  readonly model: SessionWorkModel;
  readonly agents: ReadonlyArray<Agent>;
  readonly now: number;
};

const NO_GROUPS: ReadonlyArray<LiveGroupModel> = [];

export const useLiveGroups = ({ model, agents, now }: Params): ReadonlyArray<LiveGroupModel> => {
  const previous = useRef<ReadonlyArray<LiveGroupModel>>(NO_GROUPS);
  return useMemo(() => {
    const before = previous.current;
    const next = keepEqualById({
      previous: new Map(before.map((group) => [group.id, group])),
      next: liveGroupsOf({ model, agents, now }),
    });
    const isUnchanged =
      next.length === before.length && next.every((group, index) => group === before[index]);
    const groups = isUnchanged ? before : next;
    previous.current = groups;
    return groups;
  }, [agents, model, now]);
};
