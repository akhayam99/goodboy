// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectId, PublishOutcome } from '@goodboy/types';
import { aProject } from '@goodboy/types/testing';
import { useAppStore, type AppStore } from '../../store';
import type { GetFn, SetFn } from './types';

const h = vi.hoisted(() => ({
  projectPublishMain: vi.fn(async (): Promise<PublishOutcome> => ({
    kind: 'published',
    branch: 'main',
    sha: 'abc1234',
  })),
  loadProjectGitStatus: vi.fn(async () => undefined),
}));

vi.mock('@goodboy/db', async () => (await import('../../../test/dbMock')).createDbMock({}));
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));
vi.mock('../../../shared/lib/repo', () => ({ projectPublishMain: h.projectPublishMain }));

import { publishProjectMain } from './publishProjectMain';

const PROJECT_ID = 'proj-cascadia' as ProjectId;

const makeStore = () => {
  const project = aProject({ id: PROJECT_ID, kind: 'repo', rootPath: '/games/cascadia' });
  const store: { state: AppStore } = {
    state: {
      ...useAppStore.getState(),
      projects: [project],
      loadProjectGitStatus: h.loadProjectGitStatus,
    },
  };
  const set: SetFn = (partial) => {
    const next = typeof partial === 'function' ? partial(store.state) : partial;
    store.state = { ...store.state, ...next };
  };
  const get: GetFn = () => store.state;
  return { project, set, get };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('publishProjectMain', () => {
  it('publishes the project folder and refreshes its git status', async () => {
    const { project, set, get } = makeStore();

    const outcome = await publishProjectMain(set, get)({ projectId: PROJECT_ID });

    expect(outcome).toEqual({ kind: 'published', branch: 'main', sha: 'abc1234' });
    expect(h.projectPublishMain).toHaveBeenCalledWith({
      projectPath: '/games/cascadia',
      workspaceId: project.workspaceId,
      projectId: PROJECT_ID,
    });
    expect(h.loadProjectGitStatus).toHaveBeenCalledWith({ projectId: PROJECT_ID });
  });

  it('returns a refusal as an outcome and still refreshes the status', async () => {
    const { set, get } = makeStore();
    h.projectPublishMain.mockResolvedValueOnce({ kind: 'remote-has-main', branch: 'main' });

    const outcome = await publishProjectMain(set, get)({ projectId: PROJECT_ID });

    expect(outcome).toEqual({ kind: 'remote-has-main', branch: 'main' });
    expect(h.loadProjectGitStatus).toHaveBeenCalledTimes(1);
  });

  it('refuses an unknown project', async () => {
    const { set, get } = makeStore();

    await expect(
      publishProjectMain(set, get)({ projectId: 'proj-missing' as ProjectId }),
    ).rejects.toThrow('project not found');
    expect(h.projectPublishMain).not.toHaveBeenCalled();
  });
});
