// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { WorkspaceGitStatus } from '@goodboy/types';
import { projectUpdateBlockReasonOf } from './projectGitPresentation';

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
      '1 file has changes that are not committed. Commit or stash them first.',
    );
  });

  it('blocks a repo with no upstream', () => {
    const status = readyStatus({ upstream: null });

    expect(projectUpdateBlockReasonOf({ status })).toBe('this branch tracks no upstream yet');
  });
});
