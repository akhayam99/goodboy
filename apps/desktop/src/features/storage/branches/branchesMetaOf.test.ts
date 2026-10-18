// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { ProjectBranch } from '../../worktree/branchCleanup';
import { branchStateLabel } from './branchStateLabel';
import { branchesMetaOf } from './branchesMetaOf';
import { classifyBranch } from './classifyBranch';

const NOW = Date.parse('2026-09-27T10:00:00.000Z');
const nowS = NOW / 1000;

const branch = (patch: Partial<ProjectBranch>): ProjectBranch => ({
  name: 'hl/flaky-retry-test',
  sha: 'abc',
  authorEmail: 'mara@harborline.test',
  lastCommitAt: nowS - 86_400,
  location: 'on-origin',
  mergeState: { kind: 'merged-via-pr' },
  behind: null,
  ...patch,
});

const classify = (patch: Partial<ProjectBranch>) =>
  classifyBranch({
    branch: branch(patch),
    goodboySessions: new Map(),
    userEmail: 'mara@harborline.test',
    now: NOW,
  });

describe('branchesMetaOf', () => {
  it('counts the safe branches and the ones that need a look', () => {
    const entries = [
      classify({}),
      classify({ name: 'hl/a', mergeState: { kind: 'no-own-commits' } }),
      classify({
        name: 'hl/b',
        mergeState: { kind: 'not-merged', ahead: 3 },
        lastCommitAt: nowS - 120 * 86_400,
      }),
    ];

    expect(branchesMetaOf({ entries })).toBe('2 safe to delete · 1 need a look');
  });

  it('drops the second half when nothing needs a look', () => {
    expect(branchesMetaOf({ entries: [classify({})] })).toBe('1 safe to delete');
  });
});

describe('branchStateLabel', () => {
  it('reads Merged or No commits for a safe branch and the full verdict otherwise', () => {
    expect(branchStateLabel({ branch: branch({}), base: 'main' })).toBe('Merged');
    expect(
      branchStateLabel({
        branch: branch({ mergeState: { kind: 'no-own-commits' } }),
        base: 'main',
      }),
    ).toBe('No commits');
    expect(
      branchStateLabel({
        branch: branch({ mergeState: { kind: 'not-merged', ahead: 2 } }),
        base: 'main',
      }),
    ).toBe('Not merged · 2 commits');
  });
});
