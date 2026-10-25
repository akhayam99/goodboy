import type { WorkspaceId } from '@goodboy/types';
import { arrivedKeysOf, noteFirstSeen } from '../../../features/inbox/taskArrivals';
import { readTaskArrivals, writeTaskArrivals } from '../../../features/inbox/taskArrivalsStorage';
import type { SliceDeps } from '../../slice-types';

type NotedRecord = {
  readonly key: string;
  readonly isForMe: boolean;
};

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly records: ReadonlyArray<NotedRecord>;
};

type SameKeysParams = {
  readonly left: ReadonlyArray<string>;
  readonly right: ReadonlyArray<string>;
};

const sameKeys = ({ left, right }: SameKeysParams): boolean =>
  left.length === right.length && left.every((key, index) => key === right[index]);

export const noteTaskRecords = ({ set, get }: SliceDeps) => {
  return ({ workspaceId, records }: Params): void => {
    const state = get();
    const before = state.taskArrivals[workspaceId] ?? readTaskArrivals({ workspaceId });
    const arrivals = noteFirstSeen({
      arrivals: before,
      keys: records.map((record) => record.key),
      now: Date.now(),
    });
    const newKeys = arrivedKeysOf({
      arrivals,
      keys: records.filter((record) => record.isForMe).map((record) => record.key),
      since: arrivals.seenAt,
    });
    const hasNewLedger = arrivals !== state.taskArrivals[workspaceId];
    const hasNewKeys = !sameKeys({ left: newKeys, right: state.taskNewKeys[workspaceId] ?? [] });
    if (!hasNewLedger && !hasNewKeys) {
      return;
    }
    if (arrivals !== before) {
      writeTaskArrivals({ workspaceId, arrivals });
    }
    set((current) => ({
      taskArrivals: { ...current.taskArrivals, [workspaceId]: arrivals },
      taskNewKeys: { ...current.taskNewKeys, [workspaceId]: newKeys },
    }));
  };
};
