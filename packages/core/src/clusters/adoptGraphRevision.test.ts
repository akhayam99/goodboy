import { describe, expect, it } from 'vitest';
import type { AgentId, ClusterExecutionNode, ClusterGraph } from '@goodboy/types';
import {
  adoptGraphRevision,
  type ClusterAdoptionProgress,
  type ClusterGraphRevisionProposal,
} from './adoptGraphRevision';

const graph: ClusterGraph = {
  executionVersion: 2,
  nodes: [
    {
      id: 'discovery',
      ordinal: 0,
      title: 'Discovery',
      instructions: 'read the routing path',
      role: 'scout',
      dependsOn: [],
      expectedOutput: 'the call sites',
    },
    {
      id: 'impl',
      ordinal: 1,
      title: 'Rewrite routing',
      instructions: 'rewrite it',
      role: 'implementer',
      dependsOn: ['discovery'],
      expectedOutput: null,
    },
    {
      id: 'review',
      ordinal: 2,
      title: 'Review routing',
      instructions: 'audit the rewrite',
      role: 'reviewer',
      dependsOn: ['impl'],
      expectedOutput: 'a findings list',
    },
  ],
};

const binding = ({
  nodeId,
  agentId,
  ordinal,
  role,
}: {
  readonly nodeId: string;
  readonly agentId: string | null;
  readonly ordinal: number;
  readonly role: 'scout' | 'implementer' | 'reviewer';
}): ClusterExecutionNode => ({
  nodeId,
  agentId: agentId === null ? null : (agentId as AgentId),
  ordinal,
  role,
  state: 'active',
  supersededBy: null,
  revision: 1,
  resultState: 'pending',
});

const nodes: ReadonlyArray<ClusterExecutionNode> = [
  binding({ nodeId: 'discovery', agentId: 'a-discovery', ordinal: 0, role: 'scout' }),
  binding({ nodeId: 'impl', agentId: 'a-impl', ordinal: 1, role: 'implementer' }),
  binding({ nodeId: 'review', agentId: 'a-review', ordinal: 2, role: 'reviewer' }),
];

const progress = ({
  completed,
  running,
}: {
  readonly completed: ReadonlyArray<string>;
  readonly running: ReadonlyArray<string>;
}): ReadonlyArray<ClusterAdoptionProgress> =>
  graph.nodes.map((node) => ({
    nodeId: node.id,
    isCompleted: completed.includes(node.id),
    isRunning: running.includes(node.id),
  }));

const active = { revision: 1, graph, nodes };

const replaceImplementation: ClusterGraphRevisionProposal = {
  baseRevision: 1,
  entries: [
    { disposition: 'retain', id: 'discovery' },
    {
      disposition: 'replace',
      id: 'impl',
      node: {
        id: 'impl-split',
        title: 'Rewrite routing in two passes',
        instructions: 'split the rewrite',
        role: 'implementer',
        dependsOn: ['discovery'],
      },
    },
    { disposition: 'retain', id: 'review' },
  ],
};

describe('adoptGraphRevision', () => {
  it('refuses a proposal formed against an older revision', () => {
    const outcome = adoptGraphRevision({
      active: { ...active, revision: 2 },
      progress: progress({ completed: [], running: [] }),
      proposal: replaceImplementation,
    });
    expect(outcome.kind).toBe('refused');
    expect(outcome.kind === 'refused' ? outcome.reason : '').toContain('revision 1');
  });

  it('refuses a revision that leaves a node unaddressed', () => {
    const outcome = adoptGraphRevision({
      active,
      progress: progress({ completed: [], running: [] }),
      proposal: {
        baseRevision: 1,
        entries: [{ disposition: 'retain', id: 'discovery' }],
      },
    });
    expect(outcome).toEqual({
      kind: 'refused',
      reason: 'the revision does not say what happens to impl, review',
    });
  });

  it('refuses to replace a node that already completed', () => {
    const outcome = adoptGraphRevision({
      active,
      progress: progress({ completed: ['discovery', 'impl'], running: [] }),
      proposal: replaceImplementation,
    });
    expect(outcome.kind).toBe('refused');
    expect(outcome.kind === 'refused' ? outcome.reason : '').toContain('already completed');
  });

  it('refuses a revision naming a node the active graph does not carry', () => {
    const outcome = adoptGraphRevision({
      active,
      progress: progress({ completed: [], running: [] }),
      proposal: {
        baseRevision: 1,
        entries: [
          { disposition: 'retain', id: 'discovery' },
          { disposition: 'retain', id: 'impl' },
          { disposition: 'retain', id: 'review' },
          { disposition: 'retain', id: 'publication' },
        ],
      },
    });
    expect(outcome.kind).toBe('refused');
    expect(outcome.kind === 'refused' ? outcome.reason : '').toContain('publication');
  });

  it('refuses a revision whose appended node closes a dependency cycle', () => {
    const outcome = adoptGraphRevision({
      active,
      progress: progress({ completed: [], running: [] }),
      proposal: {
        baseRevision: 1,
        entries: [
          { disposition: 'retain', id: 'discovery' },
          { disposition: 'retain', id: 'impl' },
          { disposition: 'retain', id: 'review' },
          {
            disposition: 'append',
            node: {
              id: 'publication',
              title: 'Publish',
              instructions: 'open the pull request',
              dependsOn: ['publication'],
            },
          },
        ],
      },
    });
    expect(outcome.kind).toBe('refused');
  });

  it('supersedes the replaced node instead of deleting it and keeps its agent', () => {
    const outcome = adoptGraphRevision({
      active,
      progress: progress({ completed: ['discovery'], running: [] }),
      proposal: replaceImplementation,
    });
    expect(outcome.kind).toBe('adopted');
    if (outcome.kind !== 'adopted') {
      return;
    }
    expect(outcome.revision).toBe(2);
    const retired = outcome.nodes.find((node) => node.nodeId === 'impl');
    expect(retired?.state).toBe('superseded');
    expect(retired?.supersededBy).toBe('impl-split');
    expect(retired?.agentId).toBe('a-impl');
    expect(outcome.graph.nodes.map((node) => node.id)).toEqual([
      'discovery',
      'review',
      'impl-split',
    ]);
  });

  it('quarantines the result of an attempt that was still running when it was superseded', () => {
    const outcome = adoptGraphRevision({
      active,
      progress: progress({ completed: ['discovery'], running: ['impl'] }),
      proposal: replaceImplementation,
    });
    expect(outcome.kind === 'adopted' ? outcome.quarantined : []).toEqual(['impl']);
    const retired =
      outcome.kind === 'adopted' ? outcome.nodes.find((node) => node.nodeId === 'impl') : null;
    expect(retired?.resultState).toBe('quarantined');
  });

  it('reuses a completed result whose criteria and dependency revisions still hold', () => {
    const outcome = adoptGraphRevision({
      active,
      progress: progress({ completed: ['discovery'], running: [] }),
      proposal: replaceImplementation,
    });
    expect(outcome.kind === 'adopted' ? outcome.retained : []).toContain('discovery');
    const kept =
      outcome.kind === 'adopted' ? outcome.nodes.find((node) => node.nodeId === 'discovery') : null;
    expect(kept?.resultState).toBe('retained');
    expect(kept?.agentId).toBe('a-discovery');
  });

  it('invalidates a completed verification whose dependency changed', () => {
    const outcome = adoptGraphRevision({
      active,
      progress: progress({ completed: ['discovery', 'review'], running: [] }),
      proposal: replaceImplementation,
    });
    expect(outcome.kind).toBe('adopted');
    if (outcome.kind !== 'adopted') {
      return;
    }
    expect(outcome.invalidated).toEqual(['review']);
    expect(outcome.retained).toEqual(['discovery']);
    const retired = outcome.nodes.find((node) => node.nodeId === 'review');
    expect(retired?.state).toBe('superseded');
    expect(retired?.supersededBy).toBe('review@r2');
    const rerun = outcome.graph.nodes.find((node) => node.id === 'review@r2');
    expect(rerun?.dependsOn).toEqual(['impl-split']);
    expect(outcome.materialize.map((node) => node.id)).toEqual(['review@r2', 'impl-split']);
  });

  it('appends new nodes and their verification edges', () => {
    const outcome = adoptGraphRevision({
      active,
      progress: progress({ completed: ['discovery'], running: [] }),
      proposal: {
        baseRevision: 1,
        entries: [
          { disposition: 'retain', id: 'discovery' },
          { disposition: 'retain', id: 'impl' },
          { disposition: 'retain', id: 'review' },
          {
            disposition: 'append',
            node: {
              id: 'contract',
              title: 'Define the contract',
              instructions: 'write it down',
              role: 'docs',
              dependsOn: ['discovery'],
            },
          },
          {
            disposition: 'append',
            node: {
              id: 'contract-test',
              title: 'Test the contract',
              instructions: 'prove it',
              role: 'tester',
              dependsOn: ['contract'],
            },
          },
        ],
      },
    });
    expect(outcome.kind).toBe('adopted');
    if (outcome.kind !== 'adopted') {
      return;
    }
    expect(outcome.superseded).toEqual([]);
    expect(outcome.materialize.map((node) => node.id)).toEqual(['contract', 'contract-test']);
    expect(outcome.graph.nodes.find((node) => node.id === 'contract-test')?.dependsOn).toEqual([
      'contract',
    ]);
  });

  it('refuses a replacement whose role a plan cannot lay out', () => {
    const outcome = adoptGraphRevision({
      active,
      progress: progress({ completed: [], running: [] }),
      proposal: {
        baseRevision: 1,
        entries: [
          { disposition: 'retain', id: 'discovery' },
          {
            disposition: 'replace',
            id: 'impl',
            node: {
              id: 'impl-split',
              title: 'Rewrite',
              instructions: 'do it',
              role: 'orchestrator',
            },
          },
          { disposition: 'retain', id: 'review' },
        ],
      },
    });
    expect(outcome.kind).toBe('refused');
    expect(outcome.kind === 'refused' ? outcome.reason : '').toContain('orchestrator');
  });
});
