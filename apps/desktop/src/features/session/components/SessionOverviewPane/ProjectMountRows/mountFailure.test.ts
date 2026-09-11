import { describe, expect, it } from 'vitest';
import type { Project, ProjectId, WorkspaceId } from '@goodboy/types';
import { emptyOverrides } from '../../../../../store/storyHarness';
import { mountFailure } from './mountFailure';
import type { MountPreflight } from './useMountPreflight/resolveMountPreflight';

const project = {
  id: 'project-1' as ProjectId,
  workspaceId: 'workspace-1' as WorkspaceId,
  name: 'goodboy',
  kind: 'repo',
  rootPath: '/repos/goodboy',
  baseBranch: 'main',
  overrides: emptyOverrides,
  createdAt: '2026-07-27T00:00:00.000Z',
  updatedAt: '2026-07-27T00:00:00.000Z',
} as unknown as Project;

const preflight = {
  mountId: 'mount-1',
  slug: 'ship-it',
  branch: 'ak/ship-it',
  baseBranch: 'main',
  targetPath: '/repos/goodboy/.goodboy/worktrees/ship-it-mount-1',
  renamedFrom: null,
} as unknown as MountPreflight;

describe('mountFailure', () => {
  it('keeps the message as the cause and the plan as the detail', () => {
    const failure = mountFailure({
      error: new Error('cannot find base ref: tried origin/main'),
      project,
      preflight,
    });

    expect(failure.cause).toBe('cannot find base ref: tried origin/main');
    expect(failure.detail).toContain('branch: ak/ship-it');
    expect(failure.detail).toContain('base: main');
    expect(failure.detail).toContain('path: /repos/goodboy/.goodboy/worktrees/ship-it-mount-1');
  });

  it('records the tauri error kind when the backend sends one', () => {
    const failure = mountFailure({
      error: { kind: 'branch_in_use', message: 'branch is checked out elsewhere' },
      project,
      preflight,
    });

    expect(failure.cause).toBe('branch is checked out elsewhere');
    expect(failure.detail).toContain('kind: branch_in_use');
  });

  it('keeps a technical detail for an error json cannot serialize', () => {
    const failure = mountFailure({ error: () => 'boom', project, preflight });

    expect(failure.detail.split('\n').at(-1)).toContain('boom');
  });

  it('survives a plan that never resolved', () => {
    const failure = mountFailure({ error: 'boom', project, preflight: null });

    expect(failure.cause).toBe('boom');
    expect(failure.detail).toContain('project: goodboy (/repos/goodboy)');
    expect(failure.detail).not.toContain('branch:');
  });
});
