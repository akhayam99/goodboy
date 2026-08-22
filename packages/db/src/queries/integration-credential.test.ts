import { describe, expect, it } from 'vitest';
import type {
  IntegrationCredential,
  IntegrationCredentialId,
  IsoDateTime,
  ProjectId,
  WorkspaceIntegration,
  WorkspaceIntegrationId,
} from '@goodboy/types';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrate } from '../migrations/runner';
import {
  countWorkspacesPerIntegrationCredential,
  deleteIntegrationCredential,
  listIntegrationCredentials,
  upsertIntegrationCredential,
} from './integration-credential';
import { deleteWorkspaceIntegration, upsertWorkspaceIntegration } from './workspace-integration';

const at = (iso: string): IsoDateTime => new Date(iso).toISOString() as IsoDateTime;

const seed = async () => {
  const db = makeTestDatabase();
  await migrate(db);
  const now = Date.now();
  for (const id of ['w1', 'w2']) {
    await db.execute(
      'INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [id, id, `/tmp/${id}`, now, now],
    );
    await db.execute(
      `INSERT INTO projects (id, workspace_id, name, root_path, kind, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'repo', ?, ?)`,
      [id, id, id, `/tmp/${id}`, now, now],
    );
  }
  return db;
};

const makeCredential = (overrides: Partial<IntegrationCredential> = {}): IntegrationCredential => ({
  id: 'cred-1' as IntegrationCredentialId,
  provider: 'linear',
  label: 'Grace Hopper',
  account: 'linear.app/acme',
  createdAt: at('2026-05-21T10:00:00Z'),
  updatedAt: at('2026-05-21T10:00:00Z'),
  ...overrides,
});

const makeIntegration = (
  workspaceId: string,
  credentialId: string,
  id: string,
): WorkspaceIntegration =>
  ({
    id: id as WorkspaceIntegrationId,
    workspaceId: workspaceId as ProjectId,
    provider: 'linear',
    config: { workspaceUrlKey: 'acme', viewerUserId: 'u-1', viewerName: 'Grace Hopper' },
    credentialId: credentialId as IntegrationCredentialId,
    createdAt: at('2026-05-21T10:00:00Z'),
    updatedAt: at('2026-05-21T10:00:00Z'),
  }) as WorkspaceIntegration;

describe('integration_credentials queries', () => {
  it('lists every stored credential regardless of which workspace uses it', async () => {
    const db = await seed();
    await upsertIntegrationCredential(db, makeCredential());
    await upsertIntegrationCredential(
      db,
      makeCredential({
        id: 'cred-2' as IntegrationCredentialId,
        label: 'Ada Lovelace',
        createdAt: at('2026-05-22T10:00:00Z'),
      }),
    );

    const credentials = await listIntegrationCredentials(db);

    expect(credentials.map((credential) => credential.label)).toEqual([
      'Grace Hopper',
      'Ada Lovelace',
    ]);
    expect(credentials[0]?.account).toBe('linear.app/acme');
  });

  it('renames a credential in place without touching when it was added', async () => {
    const db = await seed();
    await upsertIntegrationCredential(db, makeCredential());

    await upsertIntegrationCredential(
      db,
      makeCredential({ label: 'Work account', updatedAt: at('2026-06-01T10:00:00Z') }),
    );

    const [credential] = await listIntegrationCredentials(db);
    expect(credential?.label).toBe('Work account');
    expect(credential?.createdAt).toBe(at('2026-05-21T10:00:00Z'));
    expect(credential?.updatedAt).toBe(at('2026-06-01T10:00:00Z'));
  });

  it('counts the workspaces holding each credential', async () => {
    const db = await seed();
    await upsertIntegrationCredential(db, makeCredential());
    await upsertIntegrationCredential(
      db,
      makeCredential({ id: 'cred-2' as IntegrationCredentialId }),
    );
    await upsertWorkspaceIntegration(db, makeIntegration('w1', 'cred-1', 'wi-1'));
    await upsertWorkspaceIntegration(db, makeIntegration('w2', 'cred-1', 'wi-2'));

    expect(await countWorkspacesPerIntegrationCredential(db)).toEqual({ 'cred-1': 2 });
  });

  it('refuses to delete a credential another workspace still references', async () => {
    const db = await seed();
    await upsertIntegrationCredential(db, makeCredential());
    await upsertWorkspaceIntegration(db, makeIntegration('w1', 'cred-1', 'wi-1'));
    await upsertWorkspaceIntegration(db, makeIntegration('w2', 'cred-1', 'wi-2'));

    await deleteWorkspaceIntegration(db, 'w1' as ProjectId, 'linear');

    await expect(
      deleteIntegrationCredential(db, 'cred-1' as IntegrationCredentialId),
    ).rejects.toThrow(/FOREIGN KEY constraint/);
    expect(await listIntegrationCredentials(db)).toHaveLength(1);
  });

  it('deletes a credential once the last workspace has let it go', async () => {
    const db = await seed();
    await upsertIntegrationCredential(db, makeCredential());
    await upsertWorkspaceIntegration(db, makeIntegration('w1', 'cred-1', 'wi-1'));

    await deleteWorkspaceIntegration(db, 'w1' as ProjectId, 'linear');
    await deleteIntegrationCredential(db, 'cred-1' as IntegrationCredentialId);

    expect(await listIntegrationCredentials(db)).toEqual([]);
    expect(await countWorkspacesPerIntegrationCredential(db)).toEqual({});
  });

  it('has nowhere to keep the secret, so listing one cannot hand it back', async () => {
    const db = await seed();
    await upsertIntegrationCredential(db, makeCredential());

    const columns = await db.select<{ name: string }>(
      "PRAGMA table_info('integration_credentials')",
    );
    expect(columns.map((column) => column.name)).toEqual([
      'id',
      'provider',
      'label',
      'account',
      'created_at',
      'updated_at',
    ]);

    const [credential] = await listIntegrationCredentials(db);
    expect(Object.keys(credential ?? {})).toEqual([
      'id',
      'provider',
      'label',
      'account',
      'createdAt',
      'updatedAt',
    ]);
  });

  it('keeps the credential when a workspace is deleted out from under it', async () => {
    const db = await seed();
    await upsertIntegrationCredential(db, makeCredential());
    await upsertWorkspaceIntegration(db, makeIntegration('w1', 'cred-1', 'wi-1'));
    await upsertWorkspaceIntegration(db, makeIntegration('w2', 'cred-1', 'wi-2'));

    await db.execute("DELETE FROM workspaces WHERE id = 'w1'");

    expect(await listIntegrationCredentials(db)).toHaveLength(1);
    expect(await countWorkspacesPerIntegrationCredential(db)).toEqual({ 'cred-1': 1 });
  });
});
