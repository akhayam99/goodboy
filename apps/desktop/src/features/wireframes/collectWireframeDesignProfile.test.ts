import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MountId, SessionId } from '@goodboy/types';
import type { AppState } from '../../store/types';

const { collectProfile, branchCommits } = vi.hoisted(() => ({
  collectProfile: vi.fn(),
  branchCommits: vi.fn(),
}));

vi.mock('./collectDesignProfile', async () => {
  const actual =
    await vi.importActual<typeof import('./collectDesignProfile')>('./collectDesignProfile');
  return { ...actual, collectDesignProfile: collectProfile };
});

vi.mock('../worktree/worktree', () => ({ listBranchCommits: branchCommits }));

vi.mock('../explore/explore', () => ({
  exploreList: async () => [],
  exploreRead: async () => {
    throw new Error('missing');
  },
}));

import {
  collectWireframeDesignProfile,
  oneOfManyMountsNote,
} from './collectWireframeDesignProfile';

const SESSION_ID = 'session-1' as SessionId;

const mountRow = ({
  mountId,
  mountName,
}: {
  readonly mountId: string;
  readonly mountName: string;
}) => ({
  mountId: mountId as MountId,
  sessionId: SESSION_ID,
  projectId: 'project-1',
  mountName,
  worktreePath: `/tmp/${mountId}`,
  lastWorktreePath: null,
  repoRoot: `/repo/${mountId}`,
  branch: 'main',
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 1,
});

const state = {
  sessions: [{ id: SESSION_ID }],
  sessionMounts: {},
  sessionProjectMounts: {
    [SESSION_ID]: [
      mountRow({ mountId: 'mount-web', mountName: 'web' }),
      mountRow({ mountId: 'mount-api', mountName: 'api' }),
    ],
  },
  sessionActiveMount: {},
} as unknown as AppState;

beforeEach(() => {
  vi.clearAllMocks();
  branchCommits.mockResolvedValue([]);
  collectProfile.mockResolvedValue({
    themeName: 'generic',
    commitSha: null,
    tailwind: null,
    tokens: [],
    variants: [],
    layoutExamples: [],
    notes: [],
  });
});

describe('collectWireframeDesignProfile', () => {
  it('reads nothing when no repository was chosen', async () => {
    const evidence = await collectWireframeDesignProfile({
      state,
      sessionId: SESSION_ID,
      mountIds: [],
    });
    expect(evidence).toEqual({ source: 'none' });
    expect(collectProfile).not.toHaveBeenCalled();
  });

  it('walks the first chosen repository alone', async () => {
    await collectWireframeDesignProfile({
      state,
      sessionId: SESSION_ID,
      mountIds: ['mount-web' as MountId, 'mount-api' as MountId],
    });
    expect(collectProfile).toHaveBeenCalledTimes(1);
    expect(collectProfile.mock.calls[0]![0]).toMatchObject({
      rootPath: '/tmp/mount-web',
      projectName: 'web',
    });
  });

  it('says in the pack that the theme came from one of the chosen repositories', async () => {
    const evidence = await collectWireframeDesignProfile({
      state,
      sessionId: SESSION_ID,
      mountIds: ['mount-web' as MountId, 'mount-api' as MountId],
    });
    expect(evidence.source).toBe('mount');
    expect(evidence.source === 'mount' ? evidence.profile.notes : []).toContain(
      oneOfManyMountsNote({ mountName: 'web', count: 2 }),
    );
  });

  it('says nothing extra when a single repository was chosen', async () => {
    const evidence = await collectWireframeDesignProfile({
      state,
      sessionId: SESSION_ID,
      mountIds: ['mount-api' as MountId],
    });
    expect(evidence.source === 'mount' ? evidence.profile.notes : ['x']).toEqual([]);
    expect(collectProfile.mock.calls[0]![0]).toMatchObject({ rootPath: '/tmp/mount-api' });
  });
});
