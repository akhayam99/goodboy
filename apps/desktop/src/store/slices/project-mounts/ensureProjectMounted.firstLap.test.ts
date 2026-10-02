// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { ProjectId, WorkspaceId } from '@goodboy/types';
import { aProject, aSession, TEST_NOW } from '@goodboy/types/testing';
import { useAppStore, type AppStore } from '../../store';
import type { GetFn, SetFn } from '../../slice-types';

vi.mock('@goodboy/db', async () => (await import('../../../test/dbMock')).createDbMock({}));
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));

import { FIRST_LAP_REFUSAL } from '../bootstrap/firstLap';
import { ensureProjectMounted } from './ensureProjectMounted';

const WORKSPACE_ID = 'ws-cascadia' as WorkspaceId;
const PROJECT_ID = 'proj-cascadia' as ProjectId;
const session = aSession({ workspaceId: WORKSPACE_ID });

const makeStore = (stage: 'first-lap' | 'done') => {
  const store: { state: AppStore } = {
    state: {
      ...useAppStore.getState(),
      sessions: [session],
      projects: [aProject({ id: PROJECT_ID, workspaceId: WORKSPACE_ID, kind: 'repo' })],
      sessionProjectMounts: {},
      bootstrapPhase: {
        [PROJECT_ID]: {
          stage,
          firstLapSessionId: session.id,
          bootstrapSessionId: null,
          snapshotId: null,
          worktreePath: null,
          branch: null,
          updatedAt: TEST_NOW,
        },
      },
    },
  };
  const set: SetFn = (partial) => {
    const next = typeof partial === 'function' ? partial(store.state) : partial;
    store.state = { ...store.state, ...next };
  };
  const get: GetFn = () => store.state;
  return { set, get };
};

describe('ensureProjectMounted during the first lap', () => {
  it('refuses to cut a worktree from every trigger while the project is in its first lap', async () => {
    const { set, get } = makeStore('first-lap');

    for (const reason of ['first turn', 'workflow step', 'agent bridge']) {
      await expect(
        ensureProjectMounted(set, get)({ sessionId: session.id, projectId: PROJECT_ID, reason }),
      ).rejects.toThrow(FIRST_LAP_REFUSAL);
    }
    expect(get().sessionProjectMounts[session.id] ?? []).toEqual([]);
  });

  it('still requires a reason before anything else', async () => {
    const { set, get } = makeStore('first-lap');

    await expect(
      ensureProjectMounted(set, get)({ sessionId: session.id, projectId: PROJECT_ID, reason: ' ' }),
    ).rejects.toThrow('requires a reason');
  });
});
