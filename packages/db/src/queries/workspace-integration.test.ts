import { describe, expect, it } from 'vitest';
import type {
  LinearIntegrationConfig,
  WorkspaceId,
  WorkspaceIntegration,
  WorkspaceIntegrationId,
  IsoDateTime,
} from '@goodboy/types';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrate } from '../migrations/runner';
import {
  deleteWorkspaceIntegration,
  getWorkspaceIntegration,
  listIntegrationsForWorkspace,
  upsertWorkspaceIntegration,
} from './workspace-integration';
import { disconnectWorkspace, listDisconnectedWorkspaces, reconnectWorkspace } from './workspace';

const workspaceId = 'w1' as WorkspaceId;

async function seed() {
  const db = makeTestDatabase();
  await migrate(db);
  const now = Date.now();
  await db.execute(
    `INSERT INTO workspaces (id, name, root_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
    [workspaceId, 'ws', '/tmp/ws', now, now],
  );
  return db;
}

function makeIntegration(overrides: Partial<WorkspaceIntegration> = {}): WorkspaceIntegration {
  const config: LinearIntegrationConfig = {
    workspaceUrlKey: 'serenis',
    viewerUserId: 'u-abc',
    viewerName: 'Amin',
  };
  const ts = new Date('2026-05-21T10:00:00Z').toISOString() as IsoDateTime;
  return {
    id: 'wi1' as WorkspaceIntegrationId,
    workspaceId,
    provider: 'linear',
    config,
    credentialKey: `goodboy.workspace.${workspaceId}.linear`,
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  };
}

describe('workspace_integrations queries', () => {
  it('upsert inserts a row, get retrieves it, config round-trips through JSON', async () => {
    const db = await seed();
    const integration = makeIntegration();
    await upsertWorkspaceIntegration(db, integration);

    const got = await getWorkspaceIntegration(db, workspaceId, 'linear');
    expect(got).not.toBeNull();
    expect(got!.id).toBe(integration.id);
    expect(got!.config.workspaceUrlKey).toBe('serenis');
    expect(got!.config.viewerUserId).toBe('u-abc');
    expect(got!.credentialKey).toBe(integration.credentialKey);
  });

  it('upsert on conflict updates config + credential_key, preserves id and created_at', async () => {
    const db = await seed();
    const initial = makeIntegration();
    await upsertWorkspaceIntegration(db, initial);

    const updated = makeIntegration({
      id: 'wi-other' as WorkspaceIntegrationId,
      config: {
        workspaceUrlKey: 'serenis',
        viewerUserId: 'u-abc',
        viewerName: 'Amin Khayam',
      },
      credentialKey: 'rotated-key',
      updatedAt: new Date('2026-05-22T10:00:00Z').toISOString() as IsoDateTime,
    });
    await upsertWorkspaceIntegration(db, updated);

    const got = await getWorkspaceIntegration(db, workspaceId, 'linear');
    expect(got!.id).toBe(initial.id);
    expect(got!.config.viewerName).toBe('Amin Khayam');
    expect(got!.credentialKey).toBe('rotated-key');
    expect(got!.createdAt).toBe(initial.createdAt);
  });

  it('list returns integrations for a workspace; delete removes by provider', async () => {
    const db = await seed();
    await upsertWorkspaceIntegration(db, makeIntegration());

    const before = await listIntegrationsForWorkspace(db, workspaceId);
    expect(before).toHaveLength(1);

    await deleteWorkspaceIntegration(db, workspaceId, 'linear');
    const after = await listIntegrationsForWorkspace(db, workspaceId);
    expect(after).toHaveLength(0);
  });

  it('integration survives soft-delete + reconnect of its workspace', async () => {
    const db = await seed();
    await upsertWorkspaceIntegration(db, makeIntegration());

    const disconnectedAt = new Date('2026-05-21T11:00:00Z').toISOString() as IsoDateTime;
    await disconnectWorkspace(db, workspaceId, disconnectedAt);

    const recents = await listDisconnectedWorkspaces(db);
    expect(recents).toHaveLength(1);

    const reconnectedAt = new Date('2026-05-21T12:00:00Z').toISOString() as IsoDateTime;
    await reconnectWorkspace(db, workspaceId, reconnectedAt);

    const got = await getWorkspaceIntegration(db, workspaceId, 'linear');
    expect(got).not.toBeNull();
    expect(got!.config.viewerUserId).toBe('u-abc');
  });
});
