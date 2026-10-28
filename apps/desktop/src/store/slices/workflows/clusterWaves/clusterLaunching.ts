import type { Agent, AgentId } from '@goodboy/types';

type ChildParams = Readonly<{
  childId: AgentId;
}>;

type PruneParams = Readonly<{
  children: ReadonlyArray<Agent>;
}>;

const claimed = new Set<AgentId>();

export const clusterLaunching = {
  claim: ({ childId }: ChildParams): boolean => {
    if (claimed.has(childId)) {
      return false;
    }
    claimed.add(childId);
    return true;
  },
  has: ({ childId }: ChildParams): boolean => claimed.has(childId),
  release: ({ childId }: ChildParams): void => {
    claimed.delete(childId);
  },
  prune: ({ children }: PruneParams): void => {
    for (const child of children) {
      if (child.status !== 'pending') {
        claimed.delete(child.id);
      }
    }
  },
};
