import type {
  ClusterGraph,
  ClusterGraphNode,
  ImplementationCluster,
  PlanClusterRole,
} from '@goodboy/types';
import {
  CLUSTER_EXECUTION_VERSION_GRAPH,
  CLUSTER_EXECUTION_VERSION_LEGACY,
  PLAN_CLUSTER_ROLES,
} from '@goodboy/types';
import { normalizeAgentRole } from '../roles';

export type ClusterGraphResult =
  Readonly<{ kind: 'valid'; graph: ClusterGraph }> | Readonly<{ kind: 'invalid'; reason: string }>;

type NormalizeParams = {
  readonly clusters: ReadonlyArray<ImplementationCluster>;
};

const PLANNABLE: ReadonlySet<string> = new Set<string>(PLAN_CLUSTER_ROLES);

export const isPlanClusterRole = (value: string): value is PlanClusterRole => PLANNABLE.has(value);

const trimmed = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const generatedId = ({ ordinal }: { readonly ordinal: number }): string => `cluster-${ordinal + 1}`;

const carriesGraphMetadata = ({ cluster }: { readonly cluster: ImplementationCluster }): boolean =>
  cluster.id !== undefined ||
  cluster.role !== undefined ||
  cluster.dependsOn !== undefined ||
  cluster.expectedOutput !== undefined;

export type PlanClusterRoleResult =
  | Readonly<{ kind: 'valid'; role: PlanClusterRole }>
  | Readonly<{ kind: 'invalid'; declared: string }>;

export const resolvePlanClusterRole = ({
  role,
}: {
  readonly role: unknown;
}): PlanClusterRoleResult => {
  if (role === undefined || role === null) {
    return { kind: 'valid', role: 'implementer' };
  }
  if (typeof role !== 'string') {
    return { kind: 'invalid', declared: String(role) };
  }
  const declared = role.trim();
  if (declared.length === 0) {
    return { kind: 'valid', role: 'implementer' };
  }
  const canonical = normalizeAgentRole({ role: declared });
  if (!isPlanClusterRole(canonical)) {
    return { kind: 'invalid', declared };
  }
  return { kind: 'valid', role: canonical };
};

export const unsupportedClusterRoleReason = ({
  label,
  declared,
}: {
  readonly label: string;
  readonly declared: string;
}): string =>
  `cluster ${label} declares role "${declared}", which a plan cannot lay out; use one of ${PLAN_CLUSTER_ROLES.join(', ')}`;

const detectCycle = ({
  nodes,
}: {
  readonly nodes: ReadonlyArray<ClusterGraphNode>;
}): string | null => {
  const pending = new Map<string, ReadonlyArray<string>>(
    nodes.map((node) => [node.id, node.dependsOn]),
  );
  const settled = new Set<string>();
  let progressed = true;
  while (progressed && settled.size < nodes.length) {
    progressed = false;
    for (const node of nodes) {
      if (settled.has(node.id)) {
        continue;
      }
      const deps = pending.get(node.id) ?? [];
      if (deps.every((dep) => settled.has(dep))) {
        settled.add(node.id);
        progressed = true;
      }
    }
  }
  if (settled.size === nodes.length) {
    return null;
  }
  const stuck = nodes.filter((node) => !settled.has(node.id)).map((node) => node.id);
  return `the clusters form a dependency cycle through ${stuck.join(', ')}`;
};

export const normalizeClusterGraph = ({ clusters }: NormalizeParams): ClusterGraphResult => {
  if (clusters.length === 0) {
    return { kind: 'invalid', reason: 'the plan declares no clusters' };
  }
  const isGraph = clusters.some((cluster) => carriesGraphMetadata({ cluster }));
  const ids: string[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < clusters.length; index += 1) {
    const cluster = clusters[index]!;
    const declared = trimmed(cluster.id);
    const id = declared.length > 0 ? declared : generatedId({ ordinal: index });
    if (seen.has(id)) {
      return { kind: 'invalid', reason: `two clusters share the id "${id}"` };
    }
    seen.add(id);
    ids.push(id);
  }

  const nodes: ClusterGraphNode[] = [];
  for (let index = 0; index < clusters.length; index += 1) {
    const cluster = clusters[index]!;
    const id = ids[index]!;
    const title = trimmed(cluster.title);
    const instructions = trimmed(cluster.instructions);
    if (title.length === 0 || instructions.length === 0) {
      return {
        kind: 'invalid',
        reason: `cluster "${id}" needs both a title and instructions`,
      };
    }
    const role = resolvePlanClusterRole({ role: cluster.role });
    if (role.kind === 'invalid') {
      return {
        kind: 'invalid',
        reason: unsupportedClusterRoleReason({ label: `"${id}"`, declared: role.declared }),
      };
    }
    const rawDependsOn = cluster.dependsOn;
    if (rawDependsOn !== undefined && !Array.isArray(rawDependsOn)) {
      return { kind: 'invalid', reason: `cluster "${id}" declares dependsOn that is not an array` };
    }
    const declaredDeps = (rawDependsOn ?? []).map((value) => trimmed(value));
    for (const dep of declaredDeps) {
      if (dep.length === 0 || !seen.has(dep)) {
        return {
          kind: 'invalid',
          reason: `cluster "${id}" depends on "${dep}", which no cluster declares`,
        };
      }
      if (dep === id) {
        return { kind: 'invalid', reason: `cluster "${id}" depends on itself` };
      }
    }
    const legacyDeps = index === 0 ? [] : [ids[index - 1]!];
    const dependsOn = isGraph ? [...new Set(declaredDeps)] : legacyDeps;
    const expectedOutput = trimmed(cluster.expectedOutput);
    nodes.push({
      id,
      ordinal: index,
      title,
      instructions,
      role: role.role,
      dependsOn,
      expectedOutput: expectedOutput.length > 0 ? expectedOutput : null,
    });
  }

  const cycle = detectCycle({ nodes });
  if (cycle !== null) {
    return { kind: 'invalid', reason: cycle };
  }

  return {
    kind: 'valid',
    graph: {
      executionVersion: isGraph
        ? CLUSTER_EXECUTION_VERSION_GRAPH
        : CLUSTER_EXECUTION_VERSION_LEGACY,
      nodes,
    },
  };
};

export type ClusterNodeProgress = Readonly<{
  nodeId: string;
  isSettled: boolean;
  isCompleted: boolean;
  isStartable: boolean;
}>;

type SelectReadyParams = {
  readonly graph: ClusterGraph;
  readonly progress: ReadonlyArray<ClusterNodeProgress>;
};

export const selectReadyClusterNode = ({
  graph,
  progress,
}: SelectReadyParams): ClusterGraphNode | null => {
  const byId = new Map(progress.map((entry) => [entry.nodeId, entry]));
  const ordered = [...graph.nodes].sort((left, right) => left.ordinal - right.ordinal);
  for (const node of ordered) {
    const entry = byId.get(node.id);
    if (entry === undefined || entry.isStartable === false) {
      continue;
    }
    const isReady = node.dependsOn.every((dep) => byId.get(dep)?.isCompleted === true);
    if (isReady === true) {
      return node;
    }
  }
  return null;
};
