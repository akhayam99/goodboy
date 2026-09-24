import type { MeasuredTurnSpan, MountId } from '@goodboy/types';

export type WorktreeLabel = {
  readonly mountId: MountId;
  readonly label: string;
};

type Params = {
  readonly spans: ReadonlyArray<MeasuredTurnSpan>;
  readonly worktrees: ReadonlyArray<WorktreeLabel>;
};

export const agentTouchedWorktrees = ({
  spans,
  worktrees,
}: Params): ReadonlyMap<string, ReadonlyArray<string>> => {
  const touchedByAgent = new Map<string, Set<MountId>>();
  for (const span of spans) {
    if (span.touchedMountIds === null || span.touchedMountIds.length === 0) {
      continue;
    }
    const touched = touchedByAgent.get(span.agentId) ?? new Set<MountId>();
    for (const mountId of span.touchedMountIds) {
      touched.add(mountId);
    }
    touchedByAgent.set(span.agentId, touched);
  }
  const labels = new Map<string, ReadonlyArray<string>>();
  for (const [agentId, touched] of touchedByAgent) {
    const names = worktrees
      .filter((worktree) => touched.has(worktree.mountId))
      .map((worktree) => worktree.label);
    if (names.length > 0) {
      labels.set(agentId, names);
    }
  }
  return labels;
};
