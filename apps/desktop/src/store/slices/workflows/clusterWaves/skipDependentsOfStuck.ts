import type { Agent, ImplementationCluster } from '@goodboy/types';
import { planClusterWaves } from '@goodboy/core/clusters';
import { DID_NOT_START_PREFIX } from '@goodboy/core/workflows';
import { isoNow } from '@goodboy/types/helpers';
import { invokeAgentUpdateStatus } from '../../../../features/workflows/workflows';

type Params = {
  readonly children: ReadonlyArray<Agent>;
  readonly clusters: ReadonlyArray<ImplementationCluster>;
  readonly stuckIndex: number;
};

export const skipDependentsOfStuck = async ({
  children,
  clusters,
  stuckIndex,
}: Params): Promise<void> => {
  if (clusters.length !== children.length) {
    return;
  }
  const { blockers } = planClusterWaves({ clusters });
  const unfinished = new Set<number>([stuckIndex]);
  let isGrowing = true;
  while (isGrowing) {
    isGrowing = false;
    for (const [index, child] of children.entries()) {
      if (unfinished.has(index) || child.status !== 'pending') {
        continue;
      }
      const blocker = (blockers[index] ?? []).find((candidate) => unfinished.has(candidate));
      if (blocker === undefined) {
        continue;
      }
      unfinished.add(index);
      isGrowing = true;
      await invokeAgentUpdateStatus(child.id, {
        status: 'skipped',
        completedAt: isoNow(),
        outputSummary: `${DID_NOT_START_PREFIX}it depends on ${children[blocker]?.name ?? 'a subagent'}, which did not finish.`,
      });
    }
  }
};
