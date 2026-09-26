import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IsoDateTime, Project, ProjectId, WorkspaceId } from '@goodboy/types';
import type { AppStore } from '../../store';
import type { GetFn, SetFn } from './types';

const h = vi.hoisted(() => ({
  updateProjectGoodboyIgnore: vi.fn(async () => undefined),
  checkGoodboyIgnoreStatus: vi.fn(),
  applyGoodboyIgnore: vi.fn(),
}));

vi.mock('@goodboy/db', () => ({
  updateProjectGoodboyIgnore: h.updateProjectGoodboyIgnore,
}));
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));
vi.mock('../../../features/worktree/goodboyIgnore', () => ({
  checkGoodboyIgnoreStatus: h.checkGoodboyIgnoreStatus,
  applyGoodboyIgnore: h.applyGoodboyIgnore,
}));

import { checkGoodboyIgnore } from './checkGoodboyIgnore';
import { saveGoodboyIgnore } from './saveGoodboyIgnore';

const NOW = '2026-09-25T00:00:00.000Z' as IsoDateTime;
const PROJECT_ID = 'proj-ledger' as ProjectId;

const EMPTY_OVERRIDES = {
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
} as const;

const makeProject = (overrides: Partial<Project> = {}): Project => ({
  id: PROJECT_ID,
  workspaceId: 'ws-harborline' as WorkspaceId,
  name: 'ledger-core',
  rootPath: '/repos/ledger-core',
  kind: 'repo',
  overrides: EMPTY_OVERRIDES,
  createdAt: NOW,
  updatedAt: NOW,
  ...overrides,
});

const makeStore = (project: Project) => {
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

describe('checkGoodboyIgnore', () => {
  it('saves existing with the source when git already ignores it', async () => {
    h.checkGoodboyIgnoreStatus.mockResolvedValue({ source: 'global', path: '/x', line: 3 });
    const { store, set, get } = makeStore(makeProject());

    await checkGoodboyIgnore(set, get)({ projectId: PROJECT_ID });

    expect(store.state.projects[0]?.goodboyIgnore).toBe('existing');
    expect(store.state.projects[0]?.goodboyIgnoreSource).toBe('global');
    expect(h.updateProjectGoodboyIgnore).toHaveBeenLastCalledWith(
      expect.objectContaining({ goodboyIgnore: 'existing', goodboyIgnoreSource: 'global' }),
    );
  });

  it('leaves the mode unset when git does not ignore it yet', async () => {
    h.checkGoodboyIgnoreStatus.mockResolvedValue({ source: 'not-ignored', path: null, line: null });
    const { store, set, get } = makeStore(makeProject());

    await checkGoodboyIgnore(set, get)({ projectId: PROJECT_ID });

    expect(store.state.projects[0]?.goodboyIgnore).toBeUndefined();
    expect(store.state.projects[0]?.goodboyIgnoreCheckedAt).toBeDefined();
  });

  it('keeps an explicit choice instead of downgrading it to existing', async () => {
    h.checkGoodboyIgnoreStatus.mockResolvedValue({ source: 'info-exclude', path: '/x', line: 1 });
    const { store, set, get } = makeStore(
      makeProject({ goodboyIgnore: 'this-mac', goodboyIgnoreSource: 'info-exclude' }),
    );

    await checkGoodboyIgnore(set, get)({ projectId: PROJECT_ID });

    expect(store.state.projects[0]?.goodboyIgnore).toBe('this-mac');
  });

  it('skips a plain folder project', async () => {
    const { store, set, get } = makeStore(makeProject({ kind: 'folder' }));

    await checkGoodboyIgnore(set, get)({ projectId: PROJECT_ID });

    expect(h.checkGoodboyIgnoreStatus).not.toHaveBeenCalled();
    expect(store.state.projects[0]?.goodboyIgnoreCheckedAt).toBeUndefined();
  });
});

describe('saveGoodboyIgnore', () => {
  it('writes the chosen mode and records the resulting source', async () => {
    h.applyGoodboyIgnore.mockResolvedValue({ source: 'info-exclude', path: '/x', line: 1 });
    const { store, set, get } = makeStore(makeProject());

    await saveGoodboyIgnore(set, get)({ projectId: PROJECT_ID, mode: 'this-mac' });

    expect(store.state.projects[0]?.goodboyIgnore).toBe('this-mac');
    expect(store.state.projects[0]?.goodboyIgnoreSource).toBe('info-exclude');
    expect(h.applyGoodboyIgnore).toHaveBeenCalledWith(
      expect.objectContaining({ repoPath: '/repos/ledger-core', mode: 'this-mac' }),
    );
  });

  it('throws instead of saving when git still does not ignore it after writing', async () => {
    h.applyGoodboyIgnore.mockResolvedValue({ source: 'not-ignored', path: null, line: null });
    const { store, set, get } = makeStore(makeProject());

    await expect(
      saveGoodboyIgnore(set, get)({ projectId: PROJECT_ID, mode: 'project' }),
    ).rejects.toThrow();
    expect(store.state.projects[0]?.goodboyIgnore).toBeUndefined();
    expect(h.updateProjectGoodboyIgnore).not.toHaveBeenCalled();
  });
});
