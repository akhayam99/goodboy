import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IsoDateTime, Project, ProjectId, WorkspaceId } from '@goodboy/types';
import type { AppStore } from '../../store';
import type { GetFn, SetFn } from './types';

const h = vi.hoisted(() => ({
  updateProjectStar: vi.fn(async () => undefined),
  updateProjectDescription: vi.fn(async () => undefined),
}));

vi.mock('@goodboy/db', () => ({
  updateProjectStar: h.updateProjectStar,
  updateProjectDescription: h.updateProjectDescription,
}));
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));

import { describeProject } from './describeProject';
import { setProjectStarred } from './setProjectStarred';

const NOW = '2026-09-25T00:00:00.000Z' as IsoDateTime;
const PROJECT_ID = 'proj-ledger' as ProjectId;

const project: Project = {
  id: PROJECT_ID,
  workspaceId: 'ws-harborline' as WorkspaceId,
  name: 'ledger-core',
  rootPath: '/repos/ledger-core',
  kind: 'repo',
  overrides: {
    defaultProviderId: null,
    defaultWorkflowId: null,
    defaultBranchPrefix: null,
    parallelEnabled: null,
    defaultVerbosity: null,
    providerBindings: null,
    taskModels: null,
    roleModels: null,
    parallelAgents: null,
    providerPool: null,
    attributionFooter: null,
    replyVoice: null,
    replyStyleNote: null,
    replyTemplateFixed: null,
    replyTemplateNoChange: null,
    resolveOnGithub: null,
    resolveCommitStyle: null,
  },
  createdAt: NOW,
  updatedAt: NOW,
};

const makeStore = () => {
  const store = { state: { projects: [project] } as unknown as AppStore };
  const set: SetFn = (partial) => {
    const next = typeof partial === 'function' ? partial(store.state) : partial;
    store.state = { ...store.state, ...next };
  };
  const get: GetFn = () => store.state;
  return { store, set, get };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('setProjectStarred', () => {
  it('stars a project and unstars it again', async () => {
    const { store, set, get } = makeStore();

    await setProjectStarred(set, get)({ projectId: PROJECT_ID, isStarred: true });
    expect(store.state.projects[0]?.starredAt).toBeDefined();
    expect(h.updateProjectStar).toHaveBeenLastCalledWith(
      expect.objectContaining({ projectId: PROJECT_ID, starredAt: expect.any(String) }),
    );

    await setProjectStarred(set, get)({ projectId: PROJECT_ID, isStarred: false });
    expect(store.state.projects[0]?.starredAt).toBeUndefined();
    expect(h.updateProjectStar).toHaveBeenLastCalledWith(
      expect.objectContaining({ projectId: PROJECT_ID, starredAt: null }),
    );
  });
});

describe('describeProject', () => {
  it('keeps one trimmed line and clears an empty description', async () => {
    const { store, set, get } = makeStore();

    await describeProject(
      set,
      get,
    )({
      projectId: PROJECT_ID,
      description: '  Settles payments\n and writes the ledger ',
    });
    expect(store.state.projects[0]?.description).toBe('Settles payments and writes the ledger');

    await describeProject(set, get)({ projectId: PROJECT_ID, description: '   ' });
    expect(store.state.projects[0]?.description).toBeNull();
    expect(h.updateProjectDescription).toHaveBeenLastCalledWith(
      expect.objectContaining({ description: null }),
    );
  });
});
