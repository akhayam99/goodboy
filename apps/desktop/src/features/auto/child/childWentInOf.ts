import type { AutoDelegation } from '@goodboy/db';
import { launchSnapshotOf, type LaunchSnapshotItem } from '../chat/launchSnapshotOf';

type Params = {
  readonly agentId: string;
  readonly delegations: ReadonlyArray<AutoDelegation>;
  readonly launchSnapshots: Readonly<Record<string, unknown>>;
};

export const childWentInOf = ({
  agentId,
  delegations,
  launchSnapshots,
}: Params): ReadonlyArray<LaunchSnapshotItem> | null => {
  const head = delegations
    .filter((candidate) => candidate.childAgentId === agentId)
    .reduce<AutoDelegation | null>(
      (latest, candidate) =>
        latest === null || candidate.createdAt > latest.createdAt ? candidate : latest,
      null,
    );
  if (head === null) {
    return null;
  }
  return launchSnapshotOf({ snapshot: launchSnapshots[head.id] ?? null });
};
