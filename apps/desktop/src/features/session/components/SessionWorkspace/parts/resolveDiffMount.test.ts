import { describe, expect, it } from 'vitest';
import type { MountId, ProjectId, SessionId, SessionProjectMount } from '@goodboy/types';
import { resolveDiffMount } from './resolveDiffMount';

const mountOf = ({
  name,
  worktreePath,
}: {
  readonly name: string;
  readonly worktreePath: string;
}): SessionProjectMount => ({
  mountId: `mount-${name}` as MountId,
  sessionId: 'session-diff' as SessionId,
  projectId: `prj-${name}` as ProjectId,
  mountName: name,
  worktreePath,
  lastWorktreePath: null,
  repoRoot: `/repos/${name}`,
  branch: 'main',
  baseBranch: null,
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 0,
});

const MOUNTS: ReadonlyArray<SessionProjectMount> = [
  mountOf({ name: 'api', worktreePath: '/wt/api' }),
  mountOf({ name: 'web', worktreePath: '/wt/web' }),
];

describe('resolveDiffMount', () => {
  it('keeps the requested mount when it is still mounted', () => {
    expect(
      resolveDiffMount({ mounts: MOUNTS, requestedPath: '/wt/web', fallbackPath: '/wt/api' }),
    ).toBe('/wt/web');
  });

  it('falls back to the active worktree when no mount was requested', () => {
    expect(resolveDiffMount({ mounts: MOUNTS, requestedPath: null, fallbackPath: '/wt/api' })).toBe(
      '/wt/api',
    );
  });

  it('falls back when the requested mount is gone', () => {
    expect(
      resolveDiffMount({ mounts: MOUNTS, requestedPath: '/wt/detached', fallbackPath: '/wt/api' }),
    ).toBe('/wt/api');
  });

  it('falls back when the session has no mounts at all', () => {
    expect(resolveDiffMount({ mounts: [], requestedPath: '/wt/web', fallbackPath: null })).toBe(
      null,
    );
  });
});
