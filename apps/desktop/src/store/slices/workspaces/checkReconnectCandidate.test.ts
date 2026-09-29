// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IsoDateTime, Project, ProjectId, Workspace, WorkspaceId } from '@goodboy/types';
import type { AppStore } from '../../store';
import type { GetFn } from './types';

const h = vi.hoisted(() => ({
  findProjectByRootPath: vi.fn(async () => null as Project | null),
  findDisconnectedProjectByIdentity: vi.fn(async () => null as Project | null),
  getWorkspaceById: vi.fn(async () => null as Workspace | null),
  describeProjectAdoption: vi.fn(async () => null as { sessionCount: number } | null),
  repoIdentity: vi.fn(async () => ({ rootCommits: [] as ReadonlyArray<string>, remoteUrl: null })),
}));

vi.mock('@goodboy/db', () => ({
  findProjectByRootPath: h.findProjectByRootPath,
  findDisconnectedProjectByIdentity: h.findDisconnectedProjectByIdentity,
  getWorkspaceById: h.getWorkspaceById,
  describeProjectAdoption: h.describeProjectAdoption,
}));
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));
vi.mock('../../../shared/lib/repo', () => ({ repoIdentity: h.repoIdentity }));

import { checkReconnectCandidate } from './checkReconnectCandidate';

const NOW = '2026-08-22T00:00:00.000Z' as IsoDateTime;
const CASCADIA = 'ws-cascadia' as WorkspaceId;

const overrides = {
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
} as const;

const disconnectedWorkspace = (): Workspace => ({
  id: CASCADIA,
  name: 'Cascadia',
  slug: 'cascadia',
  overrides,
  createdAt: NOW,
  updatedAt: NOW,
  disconnectedAt: NOW,
});

const project = ({ rootPath }: { rootPath: string }): Project => ({
  id: 'proj-cascadia' as ProjectId,
  workspaceId: CASCADIA,
  name: 'ledger-core',
  rootPath,
  kind: 'repo',
  overrides,
  createdAt: NOW,
  updatedAt: NOW,
});

const get: GetFn = (() => ({ workspaces: [] }) as unknown as AppStore) as GetFn;

beforeEach(() => {
  vi.clearAllMocks();
  h.repoIdentity.mockResolvedValue({ rootCommits: [], remoteUrl: null });
});

describe('checkReconnectCandidate slice action', () => {
  it('returns null when nothing matches by path or identity', async () => {
    const result = await checkReconnectCandidate(get)({ rootPath: '/repos/ledger-core' });
    expect(result).toBeNull();
    expect(h.findDisconnectedProjectByIdentity).not.toHaveBeenCalled();
  });

  it('offers a plain reconnect for an exact path match on a disconnected workspace', async () => {
    h.findProjectByRootPath.mockResolvedValueOnce(project({ rootPath: '/repos/ledger-core' }));
    h.getWorkspaceById.mockResolvedValueOnce(disconnectedWorkspace());
    h.describeProjectAdoption.mockResolvedValueOnce({ sessionCount: 3 });

    const result = await checkReconnectCandidate(get)({ rootPath: '/repos/ledger-core' });

    expect(result).toEqual({
      workspaceId: CASCADIA,
      workspaceName: 'Cascadia',
      disconnectedAt: NOW,
      sessionCount: 3,
      moved: null,
    });
    expect(h.repoIdentity).not.toHaveBeenCalled();
  });

  it('routes a moved folder to the disconnected project found by identity', async () => {
    h.findProjectByRootPath.mockResolvedValueOnce(null);
    h.repoIdentity.mockResolvedValueOnce({ rootCommits: ['sha-1'], remoteUrl: null });
    h.findDisconnectedProjectByIdentity.mockResolvedValueOnce(
      project({ rootPath: '/old/repos/ledger-core' }),
    );
    h.getWorkspaceById.mockResolvedValueOnce(disconnectedWorkspace());
    h.describeProjectAdoption.mockResolvedValueOnce({ sessionCount: 9 });

    const result = await checkReconnectCandidate(get)({ rootPath: '/new/repos/ledger-core' });

    expect(h.findDisconnectedProjectByIdentity).toHaveBeenCalledWith({
      db: {},
      rootCommit: 'sha-1',
      remoteUrl: null,
    });
    expect(result).toEqual({
      workspaceId: CASCADIA,
      workspaceName: 'Cascadia',
      disconnectedAt: NOW,
      sessionCount: 9,
      moved: { projectId: 'proj-cascadia', fromRoot: '/old/repos/ledger-core' },
    });
  });

  it('returns null when the exact path match belongs to a workspace that is still connected', async () => {
    h.findProjectByRootPath.mockResolvedValueOnce(project({ rootPath: '/repos/ledger-core' }));
    h.getWorkspaceById.mockResolvedValueOnce({
      ...disconnectedWorkspace(),
      disconnectedAt: undefined,
    });

    const result = await checkReconnectCandidate(get)({ rootPath: '/repos/ledger-core' });

    expect(result).toBeNull();
  });
});
