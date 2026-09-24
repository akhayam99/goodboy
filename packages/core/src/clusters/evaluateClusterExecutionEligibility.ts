import type { CheckoutCleanliness, ClusterGraph, ProjectSetupCommand } from '@goodboy/types';
import { hasClusterExecutionContract } from './parseClusterWriteScope';

export type ClusterExecutionEligibilityVerdict =
  | Readonly<{ kind: 'eligible'; headSha: string }>
  | Readonly<{ kind: 'sequential'; reason: string }>;

type Params = {
  readonly graph: ClusterGraph;
  readonly setup: ProjectSetupCommand | null;
  readonly target: CheckoutCleanliness | null;
};

type DirtyParams = {
  readonly target: Extract<CheckoutCleanliness, { kind: 'dirty' }>;
};

const dirtyReason = ({ target }: DirtyParams): string => {
  const parts = [
    { count: target.staged, label: 'staged' },
    { count: target.unstaged, label: 'unstaged' },
    { count: target.unmerged, label: 'unmerged' },
    { count: target.untracked, label: 'untracked' },
  ]
    .filter((part) => part.count > 0)
    .map((part) => `${part.count} ${part.label}`);
  const detail = parts.length > 0 ? parts.join(', ') : 'changes git reports';
  return `the session checkout has uncommitted changes (${detail}), so every cluster runs one at a time`;
};

export const evaluateClusterExecutionEligibility = ({
  graph,
  setup,
  target,
}: Params): ClusterExecutionEligibilityVerdict => {
  if (!hasClusterExecutionContract({ nodes: graph.nodes })) {
    return {
      kind: 'sequential',
      reason: 'the plan declares no write scopes, so every cluster runs one at a time',
    };
  }
  if (target === null) {
    return {
      kind: 'sequential',
      reason:
        'the session writes outside a repository checkout, so every cluster runs one at a time',
    };
  }
  if (setup === null) {
    return {
      kind: 'sequential',
      reason:
        'the project has no setup command configured for private checkouts, so every cluster runs one at a time',
    };
  }
  switch (target.kind) {
    case 'clean': {
      return { kind: 'eligible', headSha: target.headSha };
    }
    case 'dirty': {
      return { kind: 'sequential', reason: dirtyReason({ target }) };
    }
    case 'unknown': {
      return {
        kind: 'sequential',
        reason: `the session checkout status could not be read (${target.reason}), so every cluster runs one at a time`,
      };
    }
    default: {
      const exhaustive: never = target;
      return exhaustive;
    }
  }
};
