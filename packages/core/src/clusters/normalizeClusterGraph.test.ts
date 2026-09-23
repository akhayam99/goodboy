import type { ImplementationCluster } from '@goodboy/types';
import { describe, expect, it } from 'vitest';
import { normalizeClusterGraph, selectReadyClusterNode } from './normalizeClusterGraph';

const legacy: ReadonlyArray<ImplementationCluster> = [
  { title: 'move files', instructions: 'relocate the domain files' },
  { title: 'update imports', instructions: 'fix the import paths' },
];

const mixed: ReadonlyArray<ImplementationCluster> = [
  { id: 'discovery', title: 'survey the routing', instructions: 'map it', role: 'scout' },
  {
    id: 'impl-a',
    title: 'rewrite the resolver',
    instructions: 'do it',
    dependsOn: ['discovery'],
  },
  {
    id: 'review',
    title: 'review the change',
    instructions: 'audit it',
    role: 'reviewer',
    dependsOn: ['impl-a'],
    expectedOutput: 'a findings list with file and line',
  },
];

describe('normalizeClusterGraph', () => {
  it('keeps a legacy plan on the implementer role and array-order edges', () => {
    const result = normalizeClusterGraph({ clusters: legacy });

    expect(result.kind).toBe('valid');
    if (result.kind !== 'valid') {
      return;
    }
    expect(result.graph.executionVersion).toBe(1);
    expect(result.graph.nodes.map((node) => node.role)).toEqual(['implementer', 'implementer']);
    expect(result.graph.nodes.map((node) => node.id)).toEqual(['cluster-1', 'cluster-2']);
    expect(result.graph.nodes.map((node) => node.dependsOn)).toEqual([[], ['cluster-1']]);
  });

  it('keeps a declared role, its dependencies and its acceptance criterion', () => {
    const result = normalizeClusterGraph({ clusters: mixed });

    expect(result.kind).toBe('valid');
    if (result.kind !== 'valid') {
      return;
    }
    expect(result.graph.executionVersion).toBe(2);
    expect(result.graph.nodes.map((node) => node.role)).toEqual([
      'scout',
      'implementer',
      'reviewer',
    ]);
    expect(result.graph.nodes[2]?.dependsOn).toEqual(['impl-a']);
    expect(result.graph.nodes[2]?.expectedOutput).toBe('a findings list with file and line');
    expect(result.graph.nodes[0]?.dependsOn).toEqual([]);
  });

  it('resolves a role alias to its canonical role', () => {
    const result = normalizeClusterGraph({
      clusters: [
        { id: 'a', title: 'diagnose', instructions: 'reproduce it', role: 'debugger' },
      ] as unknown as ReadonlyArray<ImplementationCluster>,
    });

    expect(result.kind === 'valid' && result.graph.nodes[0]?.role).toBe('investigator');
  });

  it('rejects the whole graph when two clusters share an id', () => {
    const result = normalizeClusterGraph({
      clusters: [
        { id: 'same', title: 'one', instructions: 'x' },
        { id: 'same', title: 'two', instructions: 'y' },
      ],
    });

    expect(result).toEqual({ kind: 'invalid', reason: 'two clusters share the id "same"' });
  });

  it('rejects the whole graph on a dependency cycle', () => {
    const result = normalizeClusterGraph({
      clusters: [
        { id: 'a', title: 'one', instructions: 'x', dependsOn: ['b'] },
        { id: 'b', title: 'two', instructions: 'y', dependsOn: ['a'] },
      ],
    });

    expect(result.kind).toBe('invalid');
    expect(result.kind === 'invalid' && result.reason).toContain('dependency cycle');
  });

  it('rejects the whole graph when a dependency names no cluster', () => {
    const result = normalizeClusterGraph({
      clusters: [
        { id: 'a', title: 'one', instructions: 'x' },
        { id: 'b', title: 'two', instructions: 'y', dependsOn: ['ghost'] },
      ],
    });

    expect(result.kind).toBe('invalid');
    expect(result.kind === 'invalid' && result.reason).toContain('"ghost"');
  });

  it('rejects the whole graph on a role a plan cannot lay out', () => {
    const result = normalizeClusterGraph({
      clusters: [
        { id: 'a', title: 'one', instructions: 'x', role: 'planner' },
      ] as unknown as ReadonlyArray<ImplementationCluster>,
    });

    expect(result.kind).toBe('invalid');
    expect(result.kind === 'invalid' && result.reason).toContain('planner');
  });
});

describe('selectReadyClusterNode', () => {
  it('holds a reviewer node until its implementation dependency completes', () => {
    const graph = normalizeClusterGraph({ clusters: mixed });
    expect(graph.kind).toBe('valid');
    if (graph.kind !== 'valid') {
      return;
    }
    const waiting = selectReadyClusterNode({
      graph: graph.graph,
      progress: [
        { nodeId: 'discovery', isSettled: true, isCompleted: true, isStartable: false },
        { nodeId: 'impl-a', isSettled: false, isCompleted: false, isStartable: false },
        { nodeId: 'review', isSettled: false, isCompleted: false, isStartable: true },
      ],
    });
    const released = selectReadyClusterNode({
      graph: graph.graph,
      progress: [
        { nodeId: 'discovery', isSettled: true, isCompleted: true, isStartable: false },
        { nodeId: 'impl-a', isSettled: true, isCompleted: true, isStartable: false },
        { nodeId: 'review', isSettled: false, isCompleted: false, isStartable: true },
      ],
    });

    expect(waiting).toBeNull();
    expect(released?.id).toBe('review');
  });

  it('picks the first dependency-ready node in array order', () => {
    const graph = normalizeClusterGraph({ clusters: legacy });
    expect(graph.kind).toBe('valid');
    if (graph.kind !== 'valid') {
      return;
    }
    const first = selectReadyClusterNode({
      graph: graph.graph,
      progress: [
        { nodeId: 'cluster-1', isSettled: false, isCompleted: false, isStartable: true },
        { nodeId: 'cluster-2', isSettled: false, isCompleted: false, isStartable: true },
      ],
    });

    expect(first?.id).toBe('cluster-1');
  });
});

describe('normalizeClusterGraph write scopes', () => {
  it('carries a declared write scope and leaves an undeclared node without one', () => {
    const result = normalizeClusterGraph({
      clusters: [
        {
          id: 'a',
          title: 'one',
          instructions: 'x',
          writeScope: { version: 1, files: ['src/a.ts'], directories: [] },
        },
        { id: 'b', title: 'two', instructions: 'y' },
      ],
    });

    expect(result.kind).toBe('valid');
    expect(result.kind === 'valid' && result.graph.nodes[0]?.writeScope).toEqual({
      version: 1,
      files: ['src/a.ts'],
      directories: [],
    });
    expect(result.kind === 'valid' && 'writeScope' in result.graph.nodes[1]!).toBe(false);
  });

  it('keeps a legacy list with a write scope on its array-order chain', () => {
    const result = normalizeClusterGraph({
      clusters: [
        { title: 'one', instructions: 'x', writeScope: { version: 1, files: [], directories: [] } },
        { title: 'two', instructions: 'y' },
      ],
    });

    expect(result.kind === 'valid' && result.graph.executionVersion).toBe(1);
    expect(result.kind === 'valid' && result.graph.nodes[1]?.dependsOn).toEqual(['cluster-1']);
  });

  it('rejects the whole graph when a scope uses a path alias', () => {
    const result = normalizeClusterGraph({
      clusters: [
        {
          id: 'a',
          title: 'one',
          instructions: 'x',
          writeScope: { version: 1, files: ['../escape.ts'], directories: [] },
        },
      ],
    });

    expect(result.kind).toBe('invalid');
    expect(result.kind === 'invalid' && result.reason).toContain('"../escape.ts"');
  });
});
