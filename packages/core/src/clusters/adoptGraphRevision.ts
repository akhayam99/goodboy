import type {
  ClusterExecutionNode,
  ClusterGraph,
  ClusterGraphNode,
  ImplementationCluster,
  PlanClusterRole,
} from '@goodboy/types';
import { normalizeClusterGraph, resolvePlanClusterRole } from './normalizeClusterGraph';

export type ClusterRevisionNode = Readonly<{
  id: string;
  title: string;
  instructions: string;
  role?: string;
  dependsOn?: ReadonlyArray<string>;
  expectedOutput?: string;
}>;

export type ClusterRevisionEntry =
  | Readonly<{ disposition: 'retain'; id: string }>
  | Readonly<{ disposition: 'replace'; id: string; node: ClusterRevisionNode }>
  | Readonly<{ disposition: 'append'; node: ClusterRevisionNode }>;

export type ClusterGraphRevisionProposal = Readonly<{
  baseRevision: number;
  entries: ReadonlyArray<ClusterRevisionEntry>;
}>;

export type ClusterAdoptionProgress = Readonly<{
  nodeId: string;
  isCompleted: boolean;
  isRunning: boolean;
}>;

export type ClusterAdoptionParams = {
  readonly active: Readonly<{
    revision: number;
    graph: ClusterGraph;
    nodes: ReadonlyArray<ClusterExecutionNode>;
  }>;
  readonly progress: ReadonlyArray<ClusterAdoptionProgress>;
  readonly proposal: ClusterGraphRevisionProposal;
};

export type ClusterSupersession = Readonly<{
  nodeId: string;
  supersededBy: string;
  isQuarantined: boolean;
}>;

export type ClusterAdoptionResult =
  | Readonly<{ kind: 'refused'; reason: string }>
  | Readonly<{
      kind: 'adopted';
      revision: number;
      graph: ClusterGraph;
      nodes: ReadonlyArray<ClusterExecutionNode>;
      superseded: ReadonlyArray<ClusterSupersession>;
      retained: ReadonlyArray<string>;
      invalidated: ReadonlyArray<string>;
      quarantined: ReadonlyArray<string>;
      materialize: ReadonlyArray<ClusterGraphNode>;
    }>;

const trimmed = ({ value }: { readonly value: unknown }): string =>
  typeof value === 'string' ? value.trim() : '';

const revisionSuffix = ({ id, revision }: { readonly id: string; readonly revision: number }) =>
  `${id}@r${revision}`;

type ValidatedEntry =
  | Readonly<{ kind: 'retain'; id: string }>
  | Readonly<{ kind: 'replace'; id: string; node: ClusterRevisionNode }>
  | Readonly<{ kind: 'append'; node: ClusterRevisionNode }>;

const entryId = ({ entry }: { readonly entry: ClusterRevisionEntry }): string => {
  if (entry.disposition === 'append') {
    return trimmed({ value: entry.node.id });
  }
  return trimmed({ value: entry.id });
};

type ValidationFailure = Readonly<{ kind: 'refused'; reason: string }>;

type EntryValidation =
  ValidationFailure | Readonly<{ kind: 'valid'; entries: ReadonlyArray<ValidatedEntry> }>;

const validateEntries = ({
  proposal,
  activeIds,
  knownIds,
  progressById,
}: {
  readonly proposal: ClusterGraphRevisionProposal;
  readonly activeIds: ReadonlyArray<string>;
  readonly knownIds: ReadonlySet<string>;
  readonly progressById: ReadonlyMap<string, ClusterAdoptionProgress>;
}): EntryValidation => {
  const entries: ValidatedEntry[] = [];
  const addressed = new Set<string>();
  const introduced = new Set<string>();
  for (const entry of proposal.entries) {
    const id = entryId({ entry });
    if (id.length === 0) {
      return { kind: 'refused', reason: 'the revision names a node without an id' };
    }
    if (entry.disposition === 'append') {
      if (knownIds.has(id) || introduced.has(id)) {
        return {
          kind: 'refused',
          reason: `the revision appends "${id}", which the graph already carries`,
        };
      }
      introduced.add(id);
      entries.push({ kind: 'append', node: entry.node });
      continue;
    }
    if (!knownIds.has(id)) {
      return {
        kind: 'refused',
        reason: `the revision names "${id}", which the active graph does not carry`,
      };
    }
    if (addressed.has(id)) {
      return { kind: 'refused', reason: `the revision names "${id}" twice` };
    }
    addressed.add(id);
    if (entry.disposition === 'retain') {
      entries.push({ kind: 'retain', id });
      continue;
    }
    const replacementId = trimmed({ value: entry.node.id });
    if (replacementId.length === 0) {
      return {
        kind: 'refused',
        reason: `the revision replaces "${id}" with a node that has no id`,
      };
    }
    if (knownIds.has(replacementId) || introduced.has(replacementId)) {
      return {
        kind: 'refused',
        reason: `the revision replaces "${id}" with "${replacementId}", which the graph already carries`,
      };
    }
    if (progressById.get(id)?.isCompleted === true) {
      return {
        kind: 'refused',
        reason: `"${id}" already completed, so it cannot be replaced: its result is retained or invalidated, never overwritten`,
      };
    }
    introduced.add(replacementId);
    entries.push({ kind: 'replace', id, node: entry.node });
  }
  const unaddressed = activeIds.filter((id) => !addressed.has(id));
  if (unaddressed.length > 0) {
    return {
      kind: 'refused',
      reason: `the revision does not say what happens to ${unaddressed.join(', ')}`,
    };
  }
  return { kind: 'valid', entries };
};

const resolvedRole = ({ node }: { readonly node: ClusterRevisionNode }): PlanClusterRole => {
  const outcome = resolvePlanClusterRole({ role: node.role });
  return outcome.kind === 'valid' ? outcome.role : 'implementer';
};

const declaredRole = ({ node }: { readonly node: ClusterRevisionNode }): string | null => {
  const outcome = resolvePlanClusterRole({ role: node.role });
  return outcome.kind === 'valid' ? null : outcome.declared;
};

const clusterFor = ({
  node,
  dependsOn,
}: {
  readonly node: ClusterRevisionNode;
  readonly dependsOn: ReadonlyArray<string>;
}): ImplementationCluster => ({
  id: trimmed({ value: node.id }),
  title: trimmed({ value: node.title }),
  instructions: trimmed({ value: node.instructions }),
  role: resolvedRole({ node }),
  dependsOn,
  ...(trimmed({ value: node.expectedOutput }).length > 0 && {
    expectedOutput: trimmed({ value: node.expectedOutput }),
  }),
});

export const adoptGraphRevision = ({
  active,
  progress,
  proposal,
}: ClusterAdoptionParams): ClusterAdoptionResult => {
  if (proposal.baseRevision !== active.revision) {
    return {
      kind: 'refused',
      reason: `the proposal was formed against revision ${proposal.baseRevision} and the execution is at revision ${active.revision}`,
    };
  }
  if (proposal.entries.length === 0) {
    return { kind: 'refused', reason: 'the revision carries no nodes' };
  }
  const supersededIds = new Set(
    active.nodes.filter((node) => node.state === 'superseded').map((node) => node.nodeId),
  );
  const activeGraphNodes = [...active.graph.nodes]
    .filter((node) => !supersededIds.has(node.id))
    .sort((left, right) => left.ordinal - right.ordinal);
  const knownIds = new Set([
    ...active.graph.nodes.map((node) => node.id),
    ...active.nodes.map((node) => node.nodeId),
  ]);
  const progressById = new Map(progress.map((entry) => [entry.nodeId, entry]));
  const validation = validateEntries({
    proposal,
    activeIds: activeGraphNodes.map((node) => node.id),
    knownIds,
    progressById,
  });
  if (validation.kind === 'refused') {
    return validation;
  }
  for (const entry of validation.entries) {
    if (entry.kind === 'retain') {
      continue;
    }
    const declared = declaredRole({ node: entry.node });
    if (declared !== null) {
      return {
        kind: 'refused',
        reason: `the revision gives "${trimmed({ value: entry.node.id })}" role "${declared}", which a plan cannot lay out`,
      };
    }
    if (
      trimmed({ value: entry.node.title }).length === 0 ||
      trimmed({ value: entry.node.instructions }).length === 0
    ) {
      return {
        kind: 'refused',
        reason: `the revision gives "${trimmed({ value: entry.node.id })}" no title or no instructions`,
      };
    }
  }

  const revision = active.revision + 1;
  const replacementOf = new Map<string, string>();
  for (const entry of validation.entries) {
    if (entry.kind === 'replace') {
      replacementOf.set(entry.id, trimmed({ value: entry.node.id }));
    }
  }

  const retainedIds = validation.entries.flatMap((entry) =>
    entry.kind === 'retain' ? [entry.id] : [],
  );
  const invalidated = new Set<string>();
  const remap = ({ dependencies }: { readonly dependencies: ReadonlyArray<string> }) =>
    dependencies.map((dependency) => replacementOf.get(dependency) ?? dependency);
  let settled = false;
  while (!settled) {
    settled = true;
    for (const id of retainedIds) {
      if (invalidated.has(id)) {
        continue;
      }
      const node = activeGraphNodes.find((candidate) => candidate.id === id);
      if (node === undefined) {
        continue;
      }
      const isCompleted = progressById.get(id)?.isCompleted === true;
      const isCovered = node.dependsOn.some(
        (dependency) => replacementOf.has(dependency) || invalidated.has(dependency),
      );
      if (isCompleted && isCovered) {
        invalidated.add(id);
        replacementOf.set(id, revisionSuffix({ id, revision }));
        settled = false;
      }
    }
  }

  const clusters: ImplementationCluster[] = [];
  for (const id of retainedIds) {
    if (invalidated.has(id)) {
      continue;
    }
    const node = activeGraphNodes.find((candidate) => candidate.id === id);
    if (node === undefined) {
      continue;
    }
    clusters.push({
      id: node.id,
      title: node.title,
      instructions: node.instructions,
      role: node.role,
      dependsOn: remap({ dependencies: node.dependsOn }),
      ...(node.expectedOutput !== null && { expectedOutput: node.expectedOutput }),
    });
  }
  for (const id of retainedIds) {
    if (!invalidated.has(id)) {
      continue;
    }
    const node = activeGraphNodes.find((candidate) => candidate.id === id);
    if (node === undefined) {
      continue;
    }
    clusters.push({
      id: revisionSuffix({ id, revision }),
      title: node.title,
      instructions: node.instructions,
      role: node.role,
      dependsOn: remap({ dependencies: node.dependsOn }),
      ...(node.expectedOutput !== null && { expectedOutput: node.expectedOutput }),
    });
  }
  for (const entry of validation.entries) {
    if (entry.kind === 'retain') {
      continue;
    }
    clusters.push(
      clusterFor({
        node: entry.node,
        dependsOn: remap({ dependencies: entry.node.dependsOn ?? [] }),
      }),
    );
  }

  const normalized = normalizeClusterGraph({ clusters });
  if (normalized.kind === 'invalid') {
    return { kind: 'refused', reason: normalized.reason };
  }

  const carriedIds = new Set(normalized.graph.nodes.map((node) => node.id));
  const superseded: ClusterSupersession[] = [];
  for (const [nodeId, supersededBy] of replacementOf) {
    superseded.push({
      nodeId,
      supersededBy,
      isQuarantined: progressById.get(nodeId)?.isRunning === true,
    });
  }
  const bindingOf = new Map(active.nodes.map((node) => [node.nodeId, node]));
  const carried: ClusterExecutionNode[] = normalized.graph.nodes.map((node) => {
    const binding = bindingOf.get(node.id);
    const isRetainedResult =
      binding !== undefined && progressById.get(node.id)?.isCompleted === true;
    return {
      nodeId: node.id,
      agentId: binding?.agentId ?? null,
      ordinal: node.ordinal,
      role: node.role,
      state: 'active',
      supersededBy: null,
      revision,
      resultState: isRetainedResult ? 'retained' : 'pending',
    };
  });
  const retiredBindings: ClusterExecutionNode[] = active.nodes
    .filter((node) => !carriedIds.has(node.nodeId))
    .map((node) => {
      const supersession = superseded.find((entry) => entry.nodeId === node.nodeId);
      return {
        nodeId: node.nodeId,
        agentId: node.agentId,
        ordinal: node.ordinal,
        role: node.role,
        state: 'superseded',
        supersededBy: supersession?.supersededBy ?? node.supersededBy,
        revision: node.state === 'superseded' ? node.revision : revision,
        resultState: supersession?.isQuarantined === true ? 'quarantined' : node.resultState,
      };
    });

  return {
    kind: 'adopted',
    revision,
    graph: normalized.graph,
    nodes: [...carried, ...retiredBindings],
    superseded,
    retained: retainedIds.filter((id) => !invalidated.has(id)),
    invalidated: [...invalidated],
    quarantined: superseded.filter((entry) => entry.isQuarantined).map((entry) => entry.nodeId),
    materialize: normalized.graph.nodes.filter((node) => bindingOf.get(node.id) === undefined),
  };
};
