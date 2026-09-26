import { describe, expect, it } from 'vitest';
import type { WorkspaceGitStatus } from '@goodboy/types';
import { projectGitRowStatusOf, projectUpdateBlockReasonOf } from './projectGitPresentation';

const readyStatus = (overrides: Partial<WorkspaceGitStatus> = {}): WorkspaceGitStatus => ({
  state: 'ready',
  branch: 'main',
  headSubject: 'base',
  upstreamDistance: { kind: 'known', ahead: 0, behind: 0 },
  workingTree: { kind: 'known', staged: 0, unstaged: 0, untracked: 0, unmerged: 0, changed: 0 },
  upstream: 'origin/main',
  inProgress: null,
  ...overrides,
});

describe('projectGitRowStatusOf', () => {
  it('reports a repo behind origin as updatable', () => {
    const status = readyStatus({ upstreamDistance: { kind: 'known', ahead: 0, behind: 3 } });

    expect(projectGitRowStatusOf({ status })).toEqual({
      kind: 'behind',
      label: '3 behind',
      updatable: true,
    });
  });

  it('reports a clean up to date repo as not updatable', () => {
    expect(projectGitRowStatusOf({ status: readyStatus() })).toEqual({
      kind: 'up-to-date',
      label: 'Up to date',
      updatable: false,
    });
  });

  it('reports uncommitted changes ahead of a behind count', () => {
    const status = readyStatus({
      upstreamDistance: { kind: 'known', ahead: 0, behind: 2 },
      workingTree: { kind: 'known', staged: 1, unstaged: 0, untracked: 0, unmerged: 0, changed: 1 },
    });

    expect(projectGitRowStatusOf({ status }).kind).toBe('uncommitted');
    expect(projectGitRowStatusOf({ status }).updatable).toBe(false);
  });

  it('reports a diverged branch as not updatable', () => {
    const status = readyStatus({ upstreamDistance: { kind: 'known', ahead: 2, behind: 5 } });

    expect(projectGitRowStatusOf({ status })).toEqual({
      kind: 'diverged',
      label: 'Diverged ↑2 ↓5',
      updatable: false,
    });
  });

  it('reports no upstream and detached head distinctly', () => {
    const noUpstream = readyStatus({
      upstream: null,
      upstreamDistance: { kind: 'unknown', reason: 'no-upstream' },
    });
    const detached = readyStatus({ branch: null });

    expect(projectGitRowStatusOf({ status: noUpstream }).kind).toBe('no-upstream');
    expect(projectGitRowStatusOf({ status: detached }).kind).toBe('detached');
  });

  it('reports a stopped rebase distinctly from a read failure', () => {
    const status = readyStatus({ inProgress: 'rebase' });

    expect(projectGitRowStatusOf({ status }).kind).toBe('rebase-stopped');
  });

  it('reports a pruned upstream as a read failure, not a behind count', () => {
    const status = readyStatus({
      upstreamDistance: { kind: 'unknown', reason: 'upstream-gone' },
    });

    expect(projectGitRowStatusOf({ status }).kind).toBe('cant-read');
  });
});

describe('projectUpdateBlockReasonOf', () => {
  it('allows a clean repo behind its upstream', () => {
    const status = readyStatus({ upstreamDistance: { kind: 'known', ahead: 0, behind: 1 } });

    expect(projectUpdateBlockReasonOf({ status })).toBeNull();
  });

  it('blocks a repo already up to date', () => {
    expect(projectUpdateBlockReasonOf({ status: readyStatus() })).toBe('already up to date');
  });

  it('blocks a repo with uncommitted changes', () => {
    const status = readyStatus({
      upstreamDistance: { kind: 'known', ahead: 0, behind: 1 },
      workingTree: { kind: 'known', staged: 1, unstaged: 0, untracked: 0, unmerged: 0, changed: 1 },
    });

    expect(projectUpdateBlockReasonOf({ status })).toBe(
      'commit or stash the uncommitted changes first',
    );
  });

  it('blocks a repo with no upstream', () => {
    const status = readyStatus({ upstream: null });

    expect(projectUpdateBlockReasonOf({ status })).toBe('this branch tracks no upstream yet');
  });
});
