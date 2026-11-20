// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  brandId,
  type IsoDateTime,
  type Project,
  type ProjectId,
  type WorkspaceId,
} from '@goodboy/types';
import type { AppStore } from '../../store';
import type { GetFn, SetFn } from '../../slice-types';
import { projectRelocationInitialState } from './state';

const h = vi.hoisted(() => ({
  findMovedProjects: vi.fn(),
  repoIdentity: vi.fn(),
  projectRelocate: vi.fn(),
  projectRelocationUndo: vi.fn(),
  updateProjectIdentity: vi.fn(async () => undefined),
}));

vi.mock('../../../shared/lib/repo', () => ({
  findMovedProjects: h.findMovedProjects,
  repoIdentity: h.repoIdentity,
}));
vi.mock('../../../features/workspace/projectRelocation', () => ({
  projectRelocate: h.projectRelocate,
  projectRelocationUndo: h.projectRelocationUndo,
}));
vi.mock('@goodboy/db', async () =>
  (await import('../../../test/dbMock')).createDbMock({
    updateProjectIdentity: h.updateProjectIdentity,
  }),
);
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));

import { findMovedProjects } from './findMovedProjects';
import { relocateProjects } from './relocateProjects';
import { undoRelocation } from './undoRelocation';

const PROJECT_ID = 'project-ledger' as ProjectId;
const WORKSPACE_ID = 'workspace-harborline' as WorkspaceId;
const NOW = '2026-09-26T10:00:00.000Z' as IsoDateTime;

const project: Project = {
  id: PROJECT_ID,
  workspaceId: WORKSPACE_ID,
  name: 'ledger-core',
  rootPath: '/old/ledger-core',
  kind: 'repo',
  rootCommit: 'root-sha',
  remoteUrl: 'github.com/acme/ledger-core',
  overrides: {
    defaultProviderId: null,
    defaultBranchPrefix: null,
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
    afterMerge: null,
    defaultBranchTemplate: null,
  },
  createdAt: NOW,
  updatedAt: NOW,
};

const harness = () => {
  let state = {
    ...projectRelocationInitialState,
    projects: [project],
    projectGitStatus: {
      [PROJECT_ID]: {
        state: 'missing',
        branch: null,
        headSubject: null,
        upstreamDistance: { kind: 'unknown', reason: 'rev-list-failed' },
        workingTree: { kind: 'unknown', reason: 'status-read-failed' },
        upstream: null,
        inProgress: null,
      },
    },
  } as unknown as AppStore;
  const set: SetFn = (update) => {
    const patch = typeof update === 'function' ? update(state) : update;
    state = { ...state, ...patch };
  };
  return {
    get state() {
      return state;
    },
    set,
    get: (() => state) satisfies GetFn,
  };
};

beforeEach(() => {
  vi.clearAllMocks();
  h.findMovedProjects.mockResolvedValue([
    {
      projectId: PROJECT_ID,
      path: '/new/ledger-core',
      verdict: 'same_repository',
      identity: {
        rootCommits: ['root-sha'],
        remoteUrl: 'github.com/acme/ledger-core',
      },
    },
  ]);
  h.projectRelocate.mockResolvedValue({
    relocationId: 'relocation',
    repairedGitLinks: true,
    restoredSessionFolders: 2,
  });
  h.projectRelocationUndo.mockResolvedValue({
    relocationId: 'relocation',
    repairedGitLinks: true,
    restoredSessionFolders: 2,
  });
  h.repoIdentity.mockResolvedValue({
    rootCommits: ['root-sha'],
    remoteUrl: 'github.com/acme/ledger-core',
  });
  vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000000');
});

describe('project relocation slice', () => {
  it('preselects only a candidate with the same repository identity', async () => {
    const store = harness();

    await findMovedProjects(
      store.set,
      store.get,
    )({
      workspaceId: WORKSPACE_ID,
      parent: '/new',
    });

    expect(store.state.projectRelocationCandidates[0]).toEqual(
      expect.objectContaining({
        projectId: PROJECT_ID,
        toRoot: '/new/ledger-core',
        verdict: 'same_repository',
        isSelected: true,
      }),
    );
  });

  it('moves the selected project and keeps an undo record', async () => {
    const store = harness();
    await findMovedProjects(
      store.set,
      store.get,
    )({
      workspaceId: WORKSPACE_ID,
      parent: '/new',
    });

    await relocateProjects(store.set, store.get)();

    expect(h.projectRelocate).toHaveBeenCalledWith({
      relocationId: '00000000-0000-4000-8000-000000000000',
      projectId: PROJECT_ID,
      fromRoot: '/old/ledger-core',
      toRoot: '/new/ledger-core',
    });
    expect(store.state.projects[0]?.rootPath).toBe('/new/ledger-core');
    expect(store.state.projectRelocationCompleted[0]?.restoredSessionFolders).toBe(2);
    expect(store.state.projectRelocationPhase).toBe('success');
  });

  it('undoes the batch in reverse and restores the old root', async () => {
    const store = harness();
    await findMovedProjects(
      store.set,
      store.get,
    )({
      workspaceId: WORKSPACE_ID,
      parent: '/new',
    });
    await relocateProjects(store.set, store.get)();

    await undoRelocation(store.set, store.get)();

    expect(h.projectRelocationUndo).toHaveBeenCalledWith({
      relocationId: '00000000-0000-4000-8000-000000000000',
    });
    expect(store.state.projects[0]?.rootPath).toBe('/old/ledger-core');
    expect(store.state.projectRelocationPhase).toBe('idle');
  });

  it('shows the message of a structured relocate rejection', async () => {
    const store = harness();
    await findMovedProjects(
      store.set,
      store.get,
    )({
      workspaceId: WORKSPACE_ID,
      parent: '/new',
    });
    h.projectRelocate.mockRejectedValueOnce({ kind: 'io', message: 'the folder is locked' });

    await relocateProjects(store.set, store.get)();

    expect(store.state.projectRelocationPhase).toBe('error');
    expect(store.state.projectRelocationError).toBe('the folder is locked');
  });

  describe('with two moved folders', () => {
    const SECOND_ID = brandId<ProjectId>({ value: 'project-notify' });
    const twoFolders = () => {
      const store = harness();
      store.set({
        projects: [project, { ...project, id: SECOND_ID, rootPath: '/old/notify-relay' }],
        projectRelocationPhase: 'preview',
        projectRelocationCandidates: [
          {
            projectId: PROJECT_ID,
            name: 'ledger-core',
            fromRoot: '/old/ledger-core',
            toRoot: '/new/ledger-core',
            verdict: 'same_repository',
            identity: null,
            isSelected: true,
            status: 'ready',
          },
          {
            projectId: SECOND_ID,
            name: 'notify-relay',
            fromRoot: '/old/notify-relay',
            toRoot: '/new/notify-relay',
            verdict: 'same_repository',
            identity: null,
            isSelected: true,
            status: 'ready',
          },
        ],
      });
      return store;
    };

    it('retries only the folder that failed and keeps the undo record of the one that moved', async () => {
      const store = twoFolders();
      h.projectRelocate.mockResolvedValueOnce({
        relocationId: 'first',
        repairedGitLinks: true,
        restoredSessionFolders: 1,
      });
      h.projectRelocate.mockRejectedValueOnce({ kind: 'io', message: 'the folder is locked' });

      await relocateProjects(store.set, store.get)();

      expect(store.state.projectRelocationPhase).toBe('error');
      expect(store.state.projectRelocationCandidates.map((entry) => entry.status)).toEqual([
        'done',
        'ready',
      ]);
      h.projectRelocate.mockClear();

      await relocateProjects(store.set, store.get)();

      expect(h.projectRelocate).toHaveBeenCalledOnce();
      expect(h.projectRelocate).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: SECOND_ID }),
      );
      expect(store.state.projectRelocationPhase).toBe('success');
      expect(store.state.projectRelocationCompleted.map((entry) => entry.projectId)).toEqual([
        PROJECT_ID,
        SECOND_ID,
      ]);
    });

    it('retries the undo only for the folders still moved', async () => {
      const store = twoFolders();
      await relocateProjects(store.set, store.get)();
      h.projectRelocationUndo.mockResolvedValueOnce(undefined);
      h.projectRelocationUndo.mockRejectedValueOnce({
        kind: 'io',
        message: 'the folder is locked',
      });

      await undoRelocation(store.set, store.get)();

      expect(store.state.projectRelocationPhase).toBe('error');
      expect(store.state.projects.map((entry) => entry.rootPath)).toEqual([
        '/new/ledger-core',
        '/old/notify-relay',
      ]);
      h.projectRelocationUndo.mockClear();

      await undoRelocation(store.set, store.get)();

      expect(h.projectRelocationUndo).toHaveBeenCalledOnce();
      expect(store.state.projects.map((entry) => entry.rootPath)).toEqual([
        '/old/ledger-core',
        '/old/notify-relay',
      ]);
      expect(store.state.projectRelocationPhase).toBe('idle');
    });
  });

  it('shows the message of a structured undo rejection', async () => {
    const store = harness();
    await findMovedProjects(
      store.set,
      store.get,
    )({
      workspaceId: WORKSPACE_ID,
      parent: '/new',
    });
    await relocateProjects(store.set, store.get)();
    h.projectRelocationUndo.mockRejectedValueOnce({ kind: 'io', message: 'the folder is locked' });

    await undoRelocation(store.set, store.get)();

    expect(store.state.projectRelocationPhase).toBe('error');
    expect(store.state.projectRelocationError).toBe('the folder is locked');
  });
});
