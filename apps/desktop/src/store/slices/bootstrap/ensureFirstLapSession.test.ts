// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectId, WorkspaceId } from '@goodboy/types';
import { aProject, aSession, TEST_NOW } from '@goodboy/types/testing';
import { useAppStore, type AppStore } from '../../store';
import type { GetFn, SetFn } from '../../slice-types';

vi.mock('@goodboy/db', async () => (await import('../../../test/dbMock')).createDbMock({}));
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));

import { ensureFirstLapSession } from './ensureFirstLapSession';

const WORKSPACE_ID = 'ws-cascadia' as WorkspaceId;
const PROJECT_ID = 'proj-cascadia' as ProjectId;
const created = aSession({ workspaceId: WORKSPACE_ID, goal: 'First lap' });

const makeStore = (stage: 'first-lap' | 'done', existing = false) => {
  const createSession = vi.fn(async () => ({ session: created }));
  const setBootstrapPhase = vi.fn(async () => ({
    stage,
    firstLapSessionId: created.id,
    bootstrapSessionId: null,
    snapshotId: null,
    worktreePath: null,
    branch: null,
    updatedAt: TEST_NOW,
  }));
  const lapSession = aSession({ workspaceId: WORKSPACE_ID });
  const store: { state: AppStore } = {
    state: {
      ...useAppStore.getState(),
      projects: [aProject({ id: PROJECT_ID, workspaceId: WORKSPACE_ID, kind: 'repo' })],
      sessions: existing ? [lapSession] : [],
      bootstrapPhase: {
        [PROJECT_ID]: {
          stage,
          firstLapSessionId: existing ? lapSession.id : null,
          bootstrapSessionId: null,
          snapshotId: null,
          worktreePath: null,
          branch: null,
          updatedAt: TEST_NOW,
        },
      },
      createSession,
      setBootstrapPhase,
    },
  };
  const set: SetFn = (partial) => {
    const next = typeof partial === 'function' ? partial(store.state) : partial;
    store.state = { ...store.state, ...next };
  };
  const get: GetFn = () => store.state;
  return { set, get, createSession, setBootstrapPhase, lapSession };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ensureFirstLapSession', () => {
  it('creates one blank session without a project and records it', async () => {
    const { set, get, createSession, setBootstrapPhase } = makeStore('first-lap');

    const session = await ensureFirstLapSession(set, get)({ projectId: PROJECT_ID });

    expect(session.id).toBe(created.id);
    expect(createSession).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      goal: '',
      title: 'First lap',
      omitGoalSlot: true,
    });
    expect(setBootstrapPhase).toHaveBeenCalledWith({
      projectId: PROJECT_ID,
      patch: { firstLapSessionId: created.id },
    });
  });

  it('opens the session that already exists instead of creating a second one', async () => {
    const { set, get, createSession, lapSession } = makeStore('first-lap', true);

    const session = await ensureFirstLapSession(set, get)({ projectId: PROJECT_ID });

    expect(session.id).toBe(lapSession.id);
    expect(createSession).not.toHaveBeenCalled();
  });

  it('refuses a project that already left its first lap', async () => {
    const { set, get, createSession } = makeStore('done');

    await expect(ensureFirstLapSession(set, get)({ projectId: PROJECT_ID })).rejects.toThrow(
      'not in its first lap',
    );
    expect(createSession).not.toHaveBeenCalled();
  });
});
