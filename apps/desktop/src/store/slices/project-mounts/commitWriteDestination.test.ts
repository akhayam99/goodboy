import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MountId, ProjectId, SessionId, SessionProjectMount } from '@goodboy/types';

const { updateSessionWriteDestination } = vi.hoisted(() => ({
  updateSessionWriteDestination: vi.fn(async () => true),
}));

vi.mock('@goodboy/db', () => ({ updateSessionWriteDestination }));
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));

import { commitWriteDestination } from './commitWriteDestination';

const SESSION_ID = 'sess-1' as SessionId;
const PROJECT_ID = 'project-web' as ProjectId;
const NEXT_MOUNT_ID = 'mount-next' as MountId;
const STORED_MOUNT_ID = 'mount-stored' as MountId;

const NEXT_MOUNT = {
  mountId: NEXT_MOUNT_ID,
  sessionId: SESSION_ID,
  projectId: PROJECT_ID,
  mountName: 'web',
  worktreePath: '/container/web-next',
  lastWorktreePath: '/container/web-next',
  repoRoot: '/repos/web',
  branch: 'ak/next',
  baseBranch: null,
  parallelIndex: 1,
  isAttached: true,
  diskState: 'present',
  revision: 1,
} satisfies SessionProjectMount;

const makeState = () => ({
  sessions: [
    {
      id: SESSION_ID,
      activeMountId: STORED_MOUNT_ID as string | undefined,
      activeProjectId: PROJECT_ID as string | undefined,
    },
  ],
  sessionActiveMount: { [SESSION_ID]: STORED_MOUNT_ID } as Record<string, string | null>,
  sessionActiveProject: { [SESSION_ID]: PROJECT_ID } as Record<string, string>,
  sessionBranches: { [SESSION_ID]: 'ak/stored' } as Record<string, string>,
});

type State = ReturnType<typeof makeState>;

const commit = async ({
  state,
  previousSelection,
}: {
  readonly state: State;
  readonly previousSelection: 'held' | 'released';
}): Promise<boolean> => {
  const set = vi.fn((updater: unknown) => {
    const patch =
      typeof updater === 'function' ? (updater as (current: State) => object)(state) : updater;
    Object.assign(state, patch);
  });
  return commitWriteDestination({
    set: set as never,
    sessionId: SESSION_ID,
    mount: NEXT_MOUNT,
    previousSelection,
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  updateSessionWriteDestination.mockResolvedValue(true);
});

describe('commitWriteDestination', () => {
  it('moves the destination in memory once the database holds it', async () => {
    const state = makeState();

    const written = await commit({ state, previousSelection: 'held' });

    expect(written).toBe(true);
    expect(state.sessionActiveMount[SESSION_ID]).toBe(NEXT_MOUNT_ID);
    expect(state.sessions[0]?.activeMountId).toBe(NEXT_MOUNT_ID);
  });

  it('keeps a still stored selection when the database refuses the move', async () => {
    const state = makeState();
    updateSessionWriteDestination.mockResolvedValue(false);

    const written = await commit({ state, previousSelection: 'held' });

    expect(written).toBe(false);
    expect(state.sessionActiveMount[SESSION_ID]).toBe(STORED_MOUNT_ID);
    expect(state.sessions[0]?.activeMountId).toBe(STORED_MOUNT_ID);
  });

  it('keeps a still stored selection when the database write is rejected', async () => {
    const state = makeState();
    updateSessionWriteDestination.mockRejectedValue(new Error('database is locked'));

    const written = await commit({ state, previousSelection: 'held' });

    expect(written).toBe(false);
    expect(state.sessionActiveMount[SESSION_ID]).toBe(STORED_MOUNT_ID);
  });

  it('leaves no selection behind when the released one is already gone and the move is refused', async () => {
    const state = makeState();
    updateSessionWriteDestination.mockResolvedValue(false);

    const written = await commit({ state, previousSelection: 'released' });

    expect(written).toBe(false);
    expect(state.sessionActiveMount[SESSION_ID]).toBeNull();
    expect(state.sessions[0]?.activeMountId).toBeUndefined();
  });

  it('leaves no selection behind when the released one is already gone and the write is rejected', async () => {
    const state = makeState();
    updateSessionWriteDestination.mockRejectedValue(new Error('database is locked'));

    const written = await commit({ state, previousSelection: 'released' });

    expect(written).toBe(false);
    expect(state.sessionActiveMount[SESSION_ID]).toBeNull();
    expect(state.sessionActiveProject[SESSION_ID]).toBeUndefined();
  });
});
