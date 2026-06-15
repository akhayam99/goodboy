import { describe, expect, it } from 'vitest';
import type {
  GitlabIntegrationConfig,
  LinearIntegrationConfig,
  SentryIntegrationConfig,
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
  } as WorkspaceIntegration;
}

function makeSentryIntegration(
  overrides: Partial<WorkspaceIntegration> = {},
): WorkspaceIntegration {
  const config: SentryIntegrationConfig = {
    org: 'goodboy',
    project: 'desktop',
    projectName: 'Desktop',
    orgName: 'Goodboy',
  };
  const ts = new Date('2026-05-21T10:00:00Z').toISOString() as IsoDateTime;
  return {
    id: 'wi-sentry' as WorkspaceIntegrationId,
    workspaceId,
    provider: 'sentry',
    config,
    credentialKey: `goodboy.workspace.${workspaceId}.sentry`,
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  } as WorkspaceIntegration;
}

describe('workspace_integrations queries', () => {
  it('upsert inserts a row, get retrieves it, config round-trips through JSON', async () => {
    const db = await seed();
    const integration = makeIntegration();
    await upsertWorkspaceIntegration(db, integration);

    const got = await getWorkspaceIntegration(db, workspaceId, 'linear');
    expect(got).not.toBeNull();
    expect(got!.id).toBe(integration.id);
    expect((got!.config as LinearIntegrationConfig).workspaceUrlKey).toBe('serenis');
    expect((got!.config as LinearIntegrationConfig).viewerUserId).toBe('u-abc');
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
    expect((got!.config as LinearIntegrationConfig).viewerName).toBe('Amin Khayam');
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

  it('round-trips a gitlab integration with its host field and discriminates by provider', async () => {
    const db = await seed();
    const gitlabConfig: GitlabIntegrationConfig = {
      userName: 'Amin K',
      userId: '99',
      host: 'https://gitlab.example.com',
    };
    const gitlab = makeIntegration({
      id: 'gl-1' as WorkspaceIntegrationId,
      provider: 'gitlab',
      config: gitlabConfig,
      credentialKey: `goodboy.workspace.${workspaceId}.gitlab`,
    });
    await upsertWorkspaceIntegration(db, makeIntegration());
    await upsertWorkspaceIntegration(db, gitlab);

    const got = await getWorkspaceIntegration(db, workspaceId, 'gitlab');
    expect(got).not.toBeNull();
    expect(got!.provider).toBe('gitlab');
    expect((got!.config as GitlabIntegrationConfig).host).toBe('https://gitlab.example.com');
    expect((got!.config as GitlabIntegrationConfig).userId).toBe('99');

    const all = await listIntegrationsForWorkspace(db, workspaceId);
    expect(all.map((i) => i.provider).sort()).toEqual(['gitlab', 'linear']);
  });

  it('deletes only the targeted provider, leaving co-located integrations intact', async () => {
    const db = await seed();
    await upsertWorkspaceIntegration(db, makeIntegration());
    await upsertWorkspaceIntegration(
      db,
      makeIntegration({
        id: 'gl-2' as WorkspaceIntegrationId,
        provider: 'gitlab',
        config: { userName: 'a', userId: '1', host: 'https://gitlab.com' },
        credentialKey: `goodboy.workspace.${workspaceId}.gitlab`,
      }),
    );

    await deleteWorkspaceIntegration(db, workspaceId, 'gitlab');
    const remaining = await listIntegrationsForWorkspace(db, workspaceId);
    expect(remaining.map((i) => i.provider)).toEqual(['linear']);
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
    expect((got!.config as LinearIntegrationConfig).viewerUserId).toBe('u-abc');
  });

  it('round-trips a sentry config union through JSON', async () => {
    const db = await seed();
    const integration = makeSentryIntegration();
    await upsertWorkspaceIntegration(db, integration);

    const got = await getWorkspaceIntegration(db, workspaceId, 'sentry');
    expect(got).not.toBeNull();
    expect(got!.provider).toBe('sentry');
    const config = got!.config as SentryIntegrationConfig;
    expect(config.org).toBe('goodboy');
    expect(config.project).toBe('desktop');
    expect(config.projectName).toBe('Desktop');
    expect(config.orgName).toBe('Goodboy');
    expect(got!.credentialKey).toBe(`goodboy.workspace.${workspaceId}.sentry`);
  });

  it('persists a sentry config with optional name fields omitted', async () => {
    const db = await seed();
    await upsertWorkspaceIntegration(
      db,
      makeSentryIntegration({ config: { org: 'o', project: 'p' } }),
    );

    const got = await getWorkspaceIntegration(db, workspaceId, 'sentry');
    const config = got!.config as SentryIntegrationConfig;
    expect(config.org).toBe('o');
    expect(config.project).toBe('p');
    expect(config.projectName).toBeUndefined();
    expect(config.orgName).toBeUndefined();
  });

  it('keeps linear and sentry integrations side by side for one workspace', async () => {
    const db = await seed();
    await upsertWorkspaceIntegration(db, makeIntegration());
    await upsertWorkspaceIntegration(db, makeSentryIntegration());

    const all = await listIntegrationsForWorkspace(db, workspaceId);
    expect(all.map((i) => i.provider).sort()).toEqual(['linear', 'sentry']);

    const sentry = await getWorkspaceIntegration(db, workspaceId, 'sentry');
    const linear = await getWorkspaceIntegration(db, workspaceId, 'linear');
    expect((sentry!.config as SentryIntegrationConfig).project).toBe('desktop');
    expect((linear!.config as LinearIntegrationConfig).workspaceUrlKey).toBe('serenis');
  });

  it('delete by provider removes only the targeted integration', async () => {
    const db = await seed();
    await upsertWorkspaceIntegration(db, makeIntegration());
    await upsertWorkspaceIntegration(db, makeSentryIntegration());

    await deleteWorkspaceIntegration(db, workspaceId, 'sentry');

    const remaining = await listIntegrationsForWorkspace(db, workspaceId);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.provider).toBe('linear');
    expect(await getWorkspaceIntegration(db, workspaceId, 'sentry')).toBeNull();
  });

  it('upsert on conflict rotates the sentry project without changing id', async () => {
    const db = await seed();
    const initial = makeSentryIntegration();
    await upsertWorkspaceIntegration(db, initial);

    await upsertWorkspaceIntegration(
      db,
      makeSentryIntegration({
        id: 'wi-different' as WorkspaceIntegrationId,
        config: { org: 'goodboy', project: 'mobile', projectName: 'Mobile' },
        updatedAt: new Date('2026-05-22T10:00:00Z').toISOString() as IsoDateTime,
      }),
    );

    const got = await getWorkspaceIntegration(db, workspaceId, 'sentry');
    expect(got!.id).toBe(initial.id);
    expect((got!.config as SentryIntegrationConfig).project).toBe('mobile');
    expect(got!.createdAt).toBe(initial.createdAt);
  });

  it('rejects an unknown provider via the widened CHECK constraint', async () => {
    const db = await seed();
    await expect(
      upsertWorkspaceIntegration(db, makeSentryIntegration({ provider: 'jira' as never })),
    ).rejects.toThrow(/CHECK constraint/);
  });
});
