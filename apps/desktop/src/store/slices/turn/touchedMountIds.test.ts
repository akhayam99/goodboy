import { describe, expect, it } from 'vitest';
import type { MountId, ProjectId, SessionId, SessionProjectMount } from '@goodboy/types';
import { touchedMountIds } from './touchedMountIds';

const mount = (overrides: Partial<SessionProjectMount> = {}): SessionProjectMount => ({
  mountId: 'mount-web' as MountId,
  sessionId: 'session-touched' as SessionId,
  projectId: 'project-web' as ProjectId,
  mountName: 'acme-web',
  worktreePath: '/repo/acme-web',
  lastWorktreePath: null,
  repoRoot: '/repo/acme-web',
  branch: 'feat/checkout',
  baseBranch: null,
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 0,
  ...overrides,
});

const web = mount();
const nested = mount({
  mountId: 'mount-web-2' as MountId,
  mountName: 'acme-web 2',
  worktreePath: '/repo/acme-web/.goodboy/worktrees/second',
  parallelIndex: 1,
});
const api = mount({
  mountId: 'mount-api' as MountId,
  projectId: 'project-api' as ProjectId,
  mountName: 'acme-api',
  worktreePath: '/repo/acme-api',
  repoRoot: '/repo/acme-api',
  parallelIndex: 2,
});
const mounts = [web, nested, api];
const NONE = new Map<MountId, string>();

describe('touchedMountIds', () => {
  it('maps relative and absolute edited paths to the worktree that holds them', () => {
    expect(
      touchedMountIds({
        mounts,
        workingDir: web.worktreePath,
        editedPaths: ['src/cart.ts', '/repo/acme-api/routes/promo.ts'],
        before: NONE,
        after: NONE,
        isShared: false,
      }),
    ).toEqual([web.mountId, api.mountId]);
  });

  it('picks the innermost worktree when one sits inside another', () => {
    expect(
      touchedMountIds({
        mounts,
        workingDir: web.worktreePath,
        editedPaths: ['./.goodboy/worktrees/second/src/a.ts'],
        before: NONE,
        after: NONE,
        isShared: false,
      }),
    ).toEqual([nested.mountId]);
  });

  it('resolves parent segments and ignores paths outside every worktree', () => {
    expect(
      touchedMountIds({
        mounts,
        workingDir: web.worktreePath,
        editedPaths: ['../acme-api/index.ts', '/tmp/scratch.txt', '../acme-api-old/x.ts'],
        before: NONE,
        after: NONE,
        isShared: false,
      }),
    ).toEqual([api.mountId]);
  });

  it('counts a worktree whose change set moved during the turn', () => {
    expect(
      touchedMountIds({
        mounts,
        workingDir: web.worktreePath,
        editedPaths: [],
        before: new Map([
          [web.mountId, '1\t0\ta.ts'],
          [api.mountId, ''],
        ]),
        after: new Map([
          [web.mountId, '1\t0\ta.ts'],
          [api.mountId, '4\t1\tpromo.ts'],
        ]),
        isShared: false,
      }),
    ).toEqual([api.mountId]);
  });

  it('trusts only reported edits while another agent of the session was running', () => {
    expect(
      touchedMountIds({
        mounts,
        workingDir: web.worktreePath,
        editedPaths: ['src/cart.ts'],
        before: new Map([[api.mountId, '']]),
        after: new Map([[api.mountId, '4\t1\tpromo.ts']]),
        isShared: true,
      }),
    ).toEqual([web.mountId]);
  });

  it('skips a worktree it could not read at one of the two ends', () => {
    expect(
      touchedMountIds({
        mounts,
        workingDir: web.worktreePath,
        editedPaths: [],
        before: new Map([[api.mountId, '']]),
        after: NONE,
        isShared: false,
      }),
    ).toEqual([]);
  });

  it('reads Windows paths with backslashes', () => {
    expect(
      touchedMountIds({
        mounts: [mount({ worktreePath: 'C:\\repo\\acme-web' })],
        workingDir: 'C:\\repo\\acme-web',
        editedPaths: ['src\\cart.ts'],
        before: NONE,
        after: NONE,
        isShared: false,
      }),
    ).toEqual([web.mountId]);
  });
});
