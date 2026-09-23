import type { ClusterGraph, ProjectSetupCommand } from '@goodboy/types';
import { describe, expect, it } from 'vitest';
import { evaluateClusterExecutionEligibility } from './evaluateClusterExecutionEligibility';

const node = {
  ordinal: 0,
  title: 'rewrite',
  instructions: 'do it',
  role: 'implementer' as const,
  dependsOn: [],
  expectedOutput: null,
};

const scoped: ClusterGraph = {
  executionVersion: 2,
  nodes: [
    { ...node, id: 'a', writeScope: { version: 1, files: ['a.ts'], directories: [] } },
    { ...node, id: 'b', ordinal: 1, writeScope: { version: 1, files: [], directories: ['b'] } },
  ],
};

const legacy: ClusterGraph = { executionVersion: 1, nodes: [{ ...node, id: 'a' }] };

const setup: ProjectSetupCommand = {
  kind: 'command',
  command: 'CI=1 pnpm install --frozen-lockfile --ignore-scripts',
  revision: 1,
  updatedAt: '2026-09-23T00:00:00.000Z' as ProjectSetupCommand['updatedAt'],
};

describe('evaluateClusterExecutionEligibility', () => {
  it('admits a scoped graph on a clean target with a configured setup', () => {
    expect(
      evaluateClusterExecutionEligibility({
        graph: scoped,
        setup,
        target: { kind: 'clean', headSha: 'abc' },
      }),
    ).toEqual({ kind: 'eligible', headSha: 'abc' });
  });

  it('keeps a graph without the contract sequential', () => {
    const verdict = evaluateClusterExecutionEligibility({
      graph: legacy,
      setup,
      target: { kind: 'clean', headSha: 'abc' },
    });
    expect(verdict.kind).toBe('sequential');
    expect(verdict.kind === 'sequential' && verdict.reason).toContain('no write scopes');
  });

  it('never treats a missing setup command as success', () => {
    const verdict = evaluateClusterExecutionEligibility({
      graph: scoped,
      setup: null,
      target: { kind: 'clean', headSha: 'abc' },
    });
    expect(verdict.kind === 'sequential' && verdict.reason).toContain('no setup command');
  });

  it('accepts an explicit no-op setup', () => {
    expect(
      evaluateClusterExecutionEligibility({
        graph: scoped,
        setup: { kind: 'none', revision: 2, updatedAt: setup.updatedAt },
        target: { kind: 'clean', headSha: 'abc' },
      }).kind,
    ).toBe('eligible');
  });

  it('keeps the whole execution sequential on tracked or untracked dirtiness', () => {
    const tracked = evaluateClusterExecutionEligibility({
      graph: scoped,
      setup,
      target: { kind: 'dirty', headSha: 'abc', staged: 1, unstaged: 2, unmerged: 0, untracked: 0 },
    });
    const untracked = evaluateClusterExecutionEligibility({
      graph: scoped,
      setup,
      target: { kind: 'dirty', headSha: 'abc', staged: 0, unstaged: 0, unmerged: 0, untracked: 3 },
    });
    expect(tracked.kind === 'sequential' && tracked.reason).toContain('1 staged, 2 unstaged');
    expect(untracked.kind === 'sequential' && untracked.reason).toContain('3 untracked');
  });

  it('fails closed on an unknown or missing target', () => {
    expect(
      evaluateClusterExecutionEligibility({
        graph: scoped,
        setup,
        target: { kind: 'unknown', reason: 'git status failed' },
      }).kind,
    ).toBe('sequential');
    expect(evaluateClusterExecutionEligibility({ graph: scoped, setup, target: null }).kind).toBe(
      'sequential',
    );
  });
});
