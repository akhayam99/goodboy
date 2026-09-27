import { describe, expect, it } from 'vitest';
import type {
  IsoDateTime,
  OverrideSettings,
  Project,
  ProjectId,
  WorkspaceId,
} from '@goodboy/types';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import {
  disconnectProject,
  findDisconnectedProjectByIdentity,
  findProjectByRootPath,
  getProjectById,
  insertProject,
  listAllProjectsForWorkspace,
  listProjectsForWorkspace,
  reconnectProject,
  updateProjectKind,
  updateProjectBaseBranch,
  updateProjectDescription,
  updateProjectGoodboyIgnore,
  updateProjectStar,
  updateProjectIdentity,
} from './project';

const workspaceId = 'workspace-1' as WorkspaceId;
const EMPTY_OVERRIDES: OverrideSettings = {
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
};

const at = ({ value }: { readonly value: string }): IsoDateTime =>
  new Date(value).toISOString() as IsoDateTime;

type MakeProjectParams = {
  readonly id?: string;
  readonly overrides?: Partial<Project>;
};

const makeProject = ({ id = 'project-1', overrides = {} }: MakeProjectParams): Project => ({
  id: id as ProjectId,
  workspaceId,
  name: id,
  rootPath: `/tmp/${id}`,
  kind: 'repo',
  baseBranch: null,
  description: null,
  overrides: EMPTY_OVERRIDES,
  createdAt: at({ value: '2026-08-22T10:00:00Z' }),
  updatedAt: at({ value: '2026-08-22T10:05:00Z' }),
  ...overrides,
});

const makeDb = async () => {
  const db = await makeMigratedTestDatabase();
  const now = Date.now();
  await db.execute(
    `INSERT INTO workspaces (id, name, slug, created_at, updated_at)
     VALUES (?, 'Demo Team', 'demo-team', ?, ?)`,
    [workspaceId, now, now],
  );
  return db;
};

describe('project queries', () => {
  it('round-trips project identity, kind, path, and overrides', async () => {
    const db = await makeDb();
    const project = makeProject({
      overrides: {
        overrides: { ...EMPTY_OVERRIDES, defaultBranchPrefix: 'ak/', parallelAgents: true },
      },
    });
    await insertProject({ db, project });
    expect(await getProjectById({ db, id: project.id })).toEqual({
      ...project,
      lastAccessedAt: project.updatedAt,
    });
    expect(await findProjectByRootPath({ db, rootPath: project.rootPath })).not.toBeNull();
  });

  it('finds a project by root path regardless of trailing slashes on either side', async () => {
    const db = await makeDb();
    const clean = makeProject({ id: 'clean' });
    const slashed = makeProject({
      id: 'slashed',
      overrides: { rootPath: '/tmp/slashed/' },
    });
    await insertProject({ db, project: clean });
    await insertProject({ db, project: slashed });

    expect((await findProjectByRootPath({ db, rootPath: '/tmp/clean/' }))?.id).toBe(clean.id);
    expect((await findProjectByRootPath({ db, rootPath: '/tmp/slashed' }))?.id).toBe(slashed.id);
    expect(await findProjectByRootPath({ db, rootPath: '/tmp/ghost/' })).toBeNull();
  });

  it('lists only the active projects of a container', async () => {
    const db = await makeDb();
    const active = makeProject({ id: 'active' });
    const disconnected = makeProject({
      id: 'disconnected',
      overrides: { disconnectedAt: at({ value: '2026-08-22T11:00:00Z' }) },
    });
    await insertProject({ db, project: active });
    await insertProject({ db, project: disconnected });
    expect(
      (await listProjectsForWorkspace({ db, workspaceId })).map((project) => project.id),
    ).toEqual([active.id]);
  });

  it('lists every project of a container, disconnected ones included', async () => {
    const db = await makeDb();
    const active = makeProject({ id: 'active' });
    const disconnected = makeProject({
      id: 'disconnected',
      overrides: { disconnectedAt: at({ value: '2026-08-22T11:00:00Z' }) },
    });
    await insertProject({ db, project: active });
    await insertProject({ db, project: disconnected });
    expect(
      (await listAllProjectsForWorkspace({ db, workspaceId })).map((project) => project.id),
    ).toEqual([active.id, disconnected.id]);
  });

  it('converts a folder project and updates its canonical path', async () => {
    const db = await makeDb();
    const project = makeProject({ overrides: { kind: 'folder' } });
    await insertProject({ db, project });
    await updateProjectKind({ db, id: project.id, kind: 'repo', rootPath: '/tmp/repository' });
    const stored = await getProjectById({ db, id: project.id });
    expect(stored?.kind).toBe('repo');
    expect(stored?.rootPath).toBe('/tmp/repository');
  });

  it('updates and clears the project base branch', async () => {
    const db = await makeDb();
    const project = makeProject({});
    await insertProject({ db, project });
    await updateProjectBaseBranch({ db, projectId: project.id, baseBranch: 'develop' });
    expect((await getProjectById({ db, id: project.id }))?.baseBranch).toBe('develop');
    await updateProjectBaseBranch({ db, projectId: project.id, baseBranch: null });
    expect((await getProjectById({ db, id: project.id }))?.baseBranch).toBeNull();
  });

  it('stars a project with a description and clears both', async () => {
    const db = await makeDb();
    const project = makeProject({});
    await insertProject({ db, project });
    const starredAt = at({ value: '2026-09-25T09:00:00Z' });

    await updateProjectStar({ db, projectId: project.id, starredAt });
    await updateProjectDescription({
      db,
      projectId: project.id,
      description: 'Settles payments and writes the ledger',
    });
    const starred = await getProjectById({ db, id: project.id });
    expect(starred?.starredAt).toBe(starredAt);
    expect(starred?.description).toBe('Settles payments and writes the ledger');

    await updateProjectStar({ db, projectId: project.id, starredAt: null });
    await updateProjectDescription({ db, projectId: project.id, description: null });
    const cleared = await getProjectById({ db, id: project.id });
    expect(cleared?.starredAt).toBeUndefined();
    expect(cleared?.description).toBeNull();
  });

  it('records the goodboy ignore mode, source, and check time, then clears them', async () => {
    const db = await makeDb();
    const project = makeProject({});
    await insertProject({ db, project });
    const checkedAt = at({ value: '2026-09-25T09:00:00Z' });

    await updateProjectGoodboyIgnore({
      db,
      projectId: project.id,
      goodboyIgnore: 'this-mac',
      goodboyIgnoreSource: '.git/info/exclude',
      goodboyIgnoreCheckedAt: checkedAt,
    });
    const checked = await getProjectById({ db, id: project.id });
    expect(checked?.goodboyIgnore).toBe('this-mac');
    expect(checked?.goodboyIgnoreSource).toBe('.git/info/exclude');
    expect(checked?.goodboyIgnoreCheckedAt).toBe(checkedAt);

    await updateProjectGoodboyIgnore({
      db,
      projectId: project.id,
      goodboyIgnore: null,
      goodboyIgnoreSource: null,
      goodboyIgnoreCheckedAt: checkedAt,
    });
    const cleared = await getProjectById({ db, id: project.id });
    expect(cleared?.goodboyIgnore).toBeUndefined();
    expect(cleared?.goodboyIgnoreSource).toBeUndefined();
  });

  it('keeps the star and description a project is inserted with', async () => {
    const db = await makeDb();
    const project = makeProject({
      overrides: {
        starredAt: at({ value: '2026-09-25T09:00:00Z' }),
        description: 'Fans out receipts',
      },
    });
    await insertProject({ db, project });
    expect(await getProjectById({ db, id: project.id })).toEqual({
      ...project,
      lastAccessedAt: project.updatedAt,
    });
  });

  it('stores the repository identity and the time it was checked', async () => {
    const db = await makeDb();
    const project = makeProject({});
    await insertProject({ db, project });
    const checkedAt = at({ value: '2026-09-26T09:00:00Z' });

    await updateProjectIdentity({
      db,
      projectId: project.id,
      rootCommit: 'abc123',
      remoteUrl: 'github.com/acme/ledger-core',
      checkedAt,
    });

    const stored = await getProjectById({ db, id: project.id });
    expect(stored?.rootCommit).toBe('abc123');
    expect(stored?.remoteUrl).toBe('github.com/acme/ledger-core');
    expect(stored?.identityCheckedAt).toBe(checkedAt);
  });

  it('disconnects and reconnects a project', async () => {
    const db = await makeDb();
    const project = makeProject({});
    await insertProject({ db, project });
    await disconnectProject({ db, id: project.id, at: at({ value: '2026-08-22T11:00:00Z' }) });
    expect((await getProjectById({ db, id: project.id }))?.disconnectedAt).toBeDefined();
    await reconnectProject({ db, id: project.id, at: at({ value: '2026-08-22T12:00:00Z' }) });
    expect((await getProjectById({ db, id: project.id }))?.disconnectedAt).toBeUndefined();
  });

  it('prefers the exact identity pair over a newer clone that shares only the remote', async () => {
    const db = await makeDb();
    await db.execute('UPDATE workspaces SET disconnected_at = ? WHERE id = ?', [
      Date.now(),
      workspaceId,
    ]);
    const remoteUrl = 'github.com/acme/ledger-core';
    const identities = [
      { id: 'original', rootCommit: 'sha-1', checkedAt: '2026-08-22T11:00:00Z' },
      { id: 'rewritten', rootCommit: 'sha-2', checkedAt: '2026-08-22T12:00:00Z' },
    ];
    for (const identity of identities) {
      await insertProject({ db, project: makeProject({ id: identity.id }) });
      await updateProjectIdentity({
        db,
        projectId: identity.id as ProjectId,
        rootCommit: identity.rootCommit,
        remoteUrl,
        checkedAt: at({ value: identity.checkedAt }),
      });
    }

    const exact = await findDisconnectedProjectByIdentity({ db, rootCommit: 'sha-1', remoteUrl });
    const remoteOnly = await findDisconnectedProjectByIdentity({
      db,
      rootCommit: null,
      remoteUrl,
    });
    const conflicting = await findDisconnectedProjectByIdentity({
      db,
      rootCommit: 'sha-3',
      remoteUrl,
    });

    expect(exact?.id).toBe('original');
    expect(remoteOnly?.id).toBe('rewritten');
    expect(conflicting).toBeNull();
  });
});
