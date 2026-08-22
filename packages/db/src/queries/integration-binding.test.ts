import { describe, expect, it } from 'vitest';
import type {
  IntegrationCredentialId,
  IsoDateTime,
  LinearIntegrationConfig,
  ProjectId,
  WorkspaceId,
  WorkspaceIntegration,
  WorkspaceIntegrationId,
} from '@goodboy/types';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrate } from '../migrations/runner';
import {
  deleteIntegrationBinding,
  deleteIntegrationBindingsForProvider,
  getIntegrationBinding,
  listIntegrationBindingsForWorkspace,
  upsertIntegrationBinding,
} from './integration-binding';

const workspaceId = 'w1' as WorkspaceId;
const projectId = 'p1' as ProjectId;

const seed = async () => {
  const db = makeTestDatabase();
  await migrate(db);
  const now = Date.now();
  await db.execute(
    'INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [workspaceId, 'ws', 'ws', now, now],
  );
  await db.execute(
    `INSERT INTO projects (id, workspace_id, name, root_path, kind, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'repo', ?, ?)`,
    [projectId, workspaceId, 'Project', '/tmp/ws', now, now],
  );
  for (const credential of ['cred-linear', 'cred-linear-rotated', 'cred-github']) {
    await db.execute(
      `INSERT INTO integration_credentials (id, provider, label, account, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [credential, credential.includes('github') ? 'github' : 'linear', 'Amin', 'acme', now, now],
    );
  }
  return db;
};

type MakeBindingParams = {
  readonly id?: string;
  readonly projectId?: ProjectId | null;
  readonly credentialId?: string;
  readonly urlKey?: string;
};

const makeBinding = ({
  id = 'binding-1',
  projectId: scope = null,
  credentialId = 'cred-linear',
  urlKey = 'serenis',
}: MakeBindingParams = {}): WorkspaceIntegration => {
  const config: LinearIntegrationConfig = {
    workspaceUrlKey: urlKey,
    viewerUserId: 'u-abc',
    viewerName: 'Amin',
  };
  const now = new Date().toISOString() as IsoDateTime;
  return {
    id: id as WorkspaceIntegrationId,
    workspaceId,
    projectId: scope,
    provider: 'linear',
    config,
    credentialId: credentialId as IntegrationCredentialId,
    createdAt: now,
    updatedAt: now,
  };
};

describe('integration bindings', () => {
  it('stores a workspace-level binding and reads it back', async () => {
    const db = await seed();
    await upsertIntegrationBinding({ db, binding: makeBinding() });

    const stored = await getIntegrationBinding({
      db,
      workspaceId,
      provider: 'linear',
      projectId: null,
    });

    expect(stored?.id).toBe('binding-1');
    expect(stored?.workspaceId).toBe(workspaceId);
    expect(stored?.projectId).toBeNull();
    expect(stored?.provider).toBe('linear');
  });

  it('replaces the binding on the same scope instead of duplicating it', async () => {
    const db = await seed();
    await upsertIntegrationBinding({ db, binding: makeBinding() });
    await upsertIntegrationBinding({
      db,
      binding: makeBinding({
        id: 'binding-2',
        credentialId: 'cred-linear-rotated',
        urlKey: 'acme',
      }),
    });

    const rows = await listIntegrationBindingsForWorkspace({ db, workspaceId });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe('binding-1');
    expect(rows[0]?.credentialId).toBe('cred-linear-rotated');
    expect(rows[0]?.config).toEqual({
      workspaceUrlKey: 'acme',
      viewerUserId: 'u-abc',
      viewerName: 'Amin',
    });
  });

  it('keeps a project override beside the workspace binding', async () => {
    const db = await seed();
    await upsertIntegrationBinding({ db, binding: makeBinding() });
    await upsertIntegrationBinding({
      db,
      binding: makeBinding({ id: 'binding-override', projectId, urlKey: 'override' }),
    });

    const rows = await listIntegrationBindingsForWorkspace({ db, workspaceId });
    expect(rows.map((row) => row.projectId)).toEqual([null, projectId]);

    const override = await getIntegrationBinding({
      db,
      workspaceId,
      provider: 'linear',
      projectId,
    });
    expect(override?.id).toBe('binding-override');
  });

  it('deletes one scope without touching the other', async () => {
    const db = await seed();
    await upsertIntegrationBinding({ db, binding: makeBinding() });
    await upsertIntegrationBinding({
      db,
      binding: makeBinding({ id: 'binding-override', projectId }),
    });

    await deleteIntegrationBinding({ db, workspaceId, provider: 'linear', projectId });

    const rows = await listIntegrationBindingsForWorkspace({ db, workspaceId });
    expect(rows.map((row) => row.id)).toEqual(['binding-1']);
  });

  it('deletes every scope of a provider at once', async () => {
    const db = await seed();
    await upsertIntegrationBinding({ db, binding: makeBinding() });
    await upsertIntegrationBinding({
      db,
      binding: makeBinding({ id: 'binding-override', projectId }),
    });

    await deleteIntegrationBindingsForProvider({ db, workspaceId, provider: 'linear' });

    expect(await listIntegrationBindingsForWorkspace({ db, workspaceId })).toEqual([]);
  });

  it('accepts a github binding', async () => {
    const db = await seed();
    const now = new Date().toISOString() as IsoDateTime;
    await upsertIntegrationBinding({
      db,
      binding: {
        id: 'binding-github' as WorkspaceIntegrationId,
        workspaceId,
        projectId: null,
        provider: 'github',
        config: {},
        credentialId: 'cred-github' as IntegrationCredentialId,
        createdAt: now,
        updatedAt: now,
      },
    });

    const stored = await getIntegrationBinding({
      db,
      workspaceId,
      provider: 'github',
      projectId: null,
    });
    expect(stored?.provider).toBe('github');
  });
});
