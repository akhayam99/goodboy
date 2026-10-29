// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { WorktreeDepsCheck } from '../lib/worktreeDepsCheck';
import { depsFindingOf } from './depsFinding';

const check = (overrides: Partial<WorktreeDepsCheck>): WorktreeDepsCheck => ({
  state: 'ready',
  command: 'pnpm install --frozen-lockfile',
  source: 'pnpm-lock.yaml',
  folder: 'node_modules',
  isFolderLink: false,
  outside: [],
  ...overrides,
});

describe('depsFindingOf', () => {
  it('says nothing for a worktree that is ready, needs nothing or was not checked', () => {
    expect(depsFindingOf({ check: null })).toBeNull();
    expect(depsFindingOf({ check: check({ state: 'ready' }) })).toBeNull();
    expect(depsFindingOf({ check: check({ state: 'not-applicable', command: null }) })).toBeNull();
  });

  it('names the install command of the lockfile when dependencies are missing', () => {
    const finding = depsFindingOf({ check: check({ state: 'missing' }) });

    expect(finding?.title).toBe('Dependencies are not installed in this worktree');
    expect(finding?.command).toBe('pnpm install --frozen-lockfile');
    expect(finding?.body).toContain('"pnpm install --frozen-lockfile"');
  });

  it('says only the link is removed when the whole folder points elsewhere', () => {
    const finding = depsFindingOf({
      check: check({ state: 'outside', isFolderLink: true, outside: ['node_modules'] }),
    });

    expect(finding?.title).toBe('This worktree reads dependencies from another folder');
    expect(finding?.body).toContain('removes only the link, never the folder it points to');
  });

  it('lists the workspace packages that resolve outside the worktree', () => {
    const finding = depsFindingOf({
      check: check({
        state: 'outside',
        outside: ['node_modules/@acme/design-tokens', 'apps/web/node_modules'],
      }),
    });

    expect(finding?.body).toContain('node_modules/@acme/design-tokens, apps/web/node_modules');
    expect(finding?.body).not.toContain('removes only the link');
  });
});
