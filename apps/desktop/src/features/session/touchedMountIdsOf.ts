import type { AgentId, MeasuredTurnSpan, MountId } from '@goodboy/types';

type Params = {
  readonly spans: ReadonlyArray<MeasuredTurnSpan> | undefined;
};

export type TouchedMountIds = ReadonlyMap<AgentId, ReadonlyArray<MountId>>;

export const NO_TOUCHED_MOUNT_IDS: TouchedMountIds = new Map();

export const touchedMountIdsOf = ({ spans }: Params): TouchedMountIds => {
  if (spans === undefined) {
    return NO_TOUCHED_MOUNT_IDS;
  }
  const byAgent = new Map<AgentId, Array<MountId>>();
  for (const span of spans) {
    if (span.touchedMountIds === null) {
      continue;
    }
    const known = byAgent.get(span.agentId) ?? [];
    for (const mountId of span.touchedMountIds) {
      if (!known.includes(mountId)) {
        known.push(mountId);
      }
    }
    if (known.length > 0) {
      byAgent.set(span.agentId, known);
    }
  }
  return byAgent.size === 0 ? NO_TOUCHED_MOUNT_IDS : byAgent;
};
