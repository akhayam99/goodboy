import { describe, expect, it } from 'vitest';
import type {
  IsoDateTime,
  MountId,
  ProjectId,
  SessionId,
  SessionMountView,
  SessionProjectMount,
} from '@goodboy/types';
import { selectAutomaticTurnMount } from './selectAutomaticTurnMount';

const SESSION_ID = 'session-1' as SessionId;
const PROJECT_ID = 'project-1' as ProjectId;
const NOW = '2026-09-12T00:00:00.000Z' as IsoDateTime;

type MountParams = {
  readonly mountId: string;
  readonly parallelIndex: number;
};

const mount = ({ mountId, parallelIndex }: MountParams): SessionProjectMount => ({
  mountId: mountId as MountId,
  sessionId: SESSION_ID,
  projectId: PROJECT_ID,
  mountName: mountId,
  worktreePath: `/worktrees/${mountId}`,
  lastWorktreePath: null,
  repoRoot: '/repo',
  branch: `feature/${mountId}`,
  baseBranch: 'main',
  parallelIndex,
  isAttached: true,
  diskState: 'present',
  revision: 0,
});

type ViewParams = MountParams & {
  readonly diskState: SessionMountView['diskState'];
};

const view = ({ mountId, parallelIndex, diskState }: ViewParams): SessionMountView => ({
  id: mountId as MountId,
  sessionId: SESSION_ID,
  projectId: PROJECT_ID,
  mountName: mountId,
  worktreePath: `/worktrees/${mountId}`,
  lastWorktreePath: null,
  repoRoot: '/repo',
  branch: `feature/${mountId}`,
  baseBranch: 'main',
  parallelIndex,
  isAttached: true,
  diskState,
  revision: 0,
  repoSlug: null,
  createdAt: NOW,
  updatedAt: NOW,
});

type SelectFromParams = {
  readonly mounts: ReadonlyArray<SessionProjectMount>;
};

const selectFrom = ({ mounts }: SelectFromParams) =>
  selectAutomaticTurnMount({
    state: { sessionMounts: {}, sessionProjectMounts: { [SESSION_ID]: mounts } },
    sessionId: SESSION_ID,
  });

describe('selectAutomaticTurnMount', () => {
  it('picks the mount with the lowest parallel index', () => {
    const selected = selectFrom({
      mounts: [
        mount({ mountId: 'mount-high', parallelIndex: 3 }),
        mount({ mountId: 'mount-low', parallelIndex: 1 }),
      ],
    });

    expect(selected?.mountId).toBe('mount-low');
  });

  it('breaks an index tie with the lexicographically smallest mount id', () => {
    const selected = selectFrom({
      mounts: [
        mount({ mountId: 'mount-z', parallelIndex: 1 }),
        mount({ mountId: 'mount-a', parallelIndex: 1 }),
      ],
    });

    expect(selected?.mountId).toBe('mount-a');
  });

  it('returns the same mount when the input order is reversed', () => {
    const mounts = [
      mount({ mountId: 'mount-z', parallelIndex: 1 }),
      mount({ mountId: 'mount-a', parallelIndex: 1 }),
      mount({ mountId: 'mount-low', parallelIndex: 0 }),
    ];

    expect(selectFrom({ mounts })?.mountId).toBe('mount-low');
    expect(selectFrom({ mounts: [...mounts].reverse() })?.mountId).toBe('mount-low');
  });

  it('does not mutate the input array', () => {
    const mounts = [
      mount({ mountId: 'mount-z', parallelIndex: 2 }),
      mount({ mountId: 'mount-a', parallelIndex: 1 }),
    ];
    const before = [...mounts];

    selectFrom({ mounts });

    expect(mounts).toEqual(before);
  });

  it('returns null when there are no writable mounts', () => {
    expect(selectFrom({ mounts: [] })).toBeNull();
  });

  it('excludes missing and removed mount views', () => {
    const selected = selectAutomaticTurnMount({
      state: {
        sessionProjectMounts: {},
        sessionMounts: {
          [SESSION_ID]: [
            view({ mountId: 'mount-missing', parallelIndex: 0, diskState: 'missing' }),
            view({ mountId: 'mount-removed', parallelIndex: 1, diskState: 'removed' }),
            view({ mountId: 'mount-present', parallelIndex: 2, diskState: 'present' }),
          ],
        },
      },
      sessionId: SESSION_ID,
    });

    expect(selected?.mountId).toBe('mount-present');
  });
});
