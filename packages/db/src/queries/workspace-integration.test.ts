import { describe, expect, it } from 'vitest';
import type {
  GitlabIntegrationConfig,
  IntegrationCredentialId,
  JiraIntegrationConfig,
  LinearIntegrationConfig,
  ProjectId,
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
const projectId = 'p1' as ProjectId;

async function seed() {
  const db = makeTestDatabase();
  await migrate(db);
  const now = Date.now();
  await db.execute(
    `INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
    [workspaceId, 'ws', 'ws', now, now],
  );
  await db.execute(
    `INSERT INTO projects (id, workspace_id, name, root_path, kind, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'repo', ?, ?)`,
    [projectId, workspaceId, 'Project', '/tmp/ws', now, now],
  );
  for (const provider of ['linear', 'sentry', 'gitlab', 'jira']) {
    await db.execute(
      `INSERT INTO integration_credentials (id, provider, label, account, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [`cred-${provider}`, provider, 'Amin', 'acme', now, now],
    );
  }
  await db.execute(
    `INSERT INTO integration_credentials (id, provider, label, account, created_at, updated_at)
     VALUES ('cred-linear-rotated', 'linear', 'Amin rotated', 'acme', ?, ?)`,
    [now, now],
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
    workspaceId: projectId,
    provider: 'linear',
    config,
    credentialId: 'cred-linear' as IntegrationCredentialId,
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
    workspaceId: projectId,
    provider: 'sentry',
    config,
    credentialId: 'cred-sentry' as IntegrationCredentialId,
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

    const got = await getWorkspaceIntegration(db, projectId, 'linear');
    expect(got).not.toBeNull();
    expect(got!.id).toBe(integration.id);
    expect((got!.config as LinearIntegrationConfig).workspaceUrlKey).toBe('serenis');
    expect((got!.config as LinearIntegrationConfig).viewerUserId).toBe('u-abc');
    expect(got!.credentialId).toBe(integration.credentialId);
  });

  it('upsert on conflict updates config + credential_id, preserves id and created_at', async () => {
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
      credentialId: 'cred-linear-rotated' as IntegrationCredentialId,
      updatedAt: new Date('2026-05-22T10:00:00Z').toISOString() as IsoDateTime,
    });
    await upsertWorkspaceIntegration(db, updated);

    const got = await getWorkspaceIntegration(db, projectId, 'linear');
    expect(got!.id).toBe(initial.id);
    expect((got!.config as LinearIntegrationConfig).viewerName).toBe('Amin Khayam');
    expect(got!.credentialId).toBe('cred-linear-rotated');
    expect(got!.createdAt).toBe(initial.createdAt);
  });

  it('list returns integrations for a workspace; delete removes by provider', async () => {
    const db = await seed();
    await upsertWorkspaceIntegration(db, makeIntegration());

    const before = await listIntegrationsForWorkspace(db, projectId);
    expect(before).toHaveLength(1);

    await deleteWorkspaceIntegration(db, projectId, 'linear');
    const after = await listIntegrationsForWorkspace(db, projectId);
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
      credentialId: 'cred-gitlab' as IntegrationCredentialId,
    });
    await upsertWorkspaceIntegration(db, makeIntegration());
    await upsertWorkspaceIntegration(db, gitlab);

    const got = await getWorkspaceIntegration(db, projectId, 'gitlab');
    expect(got).not.toBeNull();
    expect(got!.provider).toBe('gitlab');
    expect((got!.config as GitlabIntegrationConfig).host).toBe('https://gitlab.example.com');
    expect((got!.config as GitlabIntegrationConfig).userId).toBe('99');

    const all = await listIntegrationsForWorkspace(db, projectId);
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
        credentialId: 'cred-gitlab' as IntegrationCredentialId,
      }),
    );

    await deleteWorkspaceIntegration(db, projectId, 'gitlab');
    const remaining = await listIntegrationsForWorkspace(db, projectId);
    expect(remaining.map((i) => i.provider)).toEqual(['linear']);
  });

  it('integration survives soft-delete + reconnect of its workspace', async () => {
    const db = await seed();
    await upsertWorkspaceIntegration(db, makeIntegration());

    const disconnectedAt = new Date('2026-05-21T11:00:00Z').toISOString() as IsoDateTime;
    await disconnectWorkspace({ db, id: workspaceId, at: disconnectedAt });

    const recents = await listDisconnectedWorkspaces({ db });
    expect(recents).toHaveLength(1);

    const reconnectedAt = new Date('2026-05-21T12:00:00Z').toISOString() as IsoDateTime;
    await reconnectWorkspace({ db, id: workspaceId, at: reconnectedAt });

    const got = await getWorkspaceIntegration(db, projectId, 'linear');
    expect(got).not.toBeNull();
    expect((got!.config as LinearIntegrationConfig).viewerUserId).toBe('u-abc');
  });

  it('round-trips a sentry config union through JSON', async () => {
    const db = await seed();
    const integration = makeSentryIntegration();
    await upsertWorkspaceIntegration(db, integration);

    const got = await getWorkspaceIntegration(db, projectId, 'sentry');
    expect(got).not.toBeNull();
    expect(got!.provider).toBe('sentry');
    const config = got!.config as SentryIntegrationConfig;
    expect(config.org).toBe('goodboy');
    expect(config.project).toBe('desktop');
    expect(config.projectName).toBe('Desktop');
    expect(config.orgName).toBe('Goodboy');
    expect(got!.credentialId).toBe('cred-sentry');
  });

  it('persists a sentry config with optional name fields omitted', async () => {
    const db = await seed();
    await upsertWorkspaceIntegration(
      db,
      makeSentryIntegration({ config: { org: 'o', project: 'p' } }),
    );

    const got = await getWorkspaceIntegration(db, projectId, 'sentry');
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

    const all = await listIntegrationsForWorkspace(db, projectId);
    expect(all.map((i) => i.provider).sort()).toEqual(['linear', 'sentry']);

    const sentry = await getWorkspaceIntegration(db, projectId, 'sentry');
    const linear = await getWorkspaceIntegration(db, projectId, 'linear');
    expect((sentry!.config as SentryIntegrationConfig).project).toBe('desktop');
    expect((linear!.config as LinearIntegrationConfig).workspaceUrlKey).toBe('serenis');
  });

  it('delete by provider removes only the targeted integration', async () => {
    const db = await seed();
    await upsertWorkspaceIntegration(db, makeIntegration());
    await upsertWorkspaceIntegration(db, makeSentryIntegration());

    await deleteWorkspaceIntegration(db, projectId, 'sentry');

    const remaining = await listIntegrationsForWorkspace(db, projectId);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.provider).toBe('linear');
    expect(await getWorkspaceIntegration(db, projectId, 'sentry')).toBeNull();
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

    const got = await getWorkspaceIntegration(db, projectId, 'sentry');
    expect(got!.id).toBe(initial.id);
    expect((got!.config as SentryIntegrationConfig).project).toBe('mobile');
    expect(got!.createdAt).toBe(initial.createdAt);
  });

  it('rejects an unknown provider via the widened CHECK constraint', async () => {
    const db = await seed();
    await expect(
      upsertWorkspaceIntegration(db, makeSentryIntegration({ provider: 'asana' as never })),
    ).rejects.toThrow(/CHECK constraint/);
  });

  it('round-trips a jira integration with its site url, email and project key', async () => {
    const db = await seed();
    const jiraConfig: JiraIntegrationConfig = {
      siteUrl: 'https://acme.atlassian.net',
      email: 'amin@acme.io',
      projectKey: 'GB',
      accountId: '5b10a2844c20165700ede21g',
      displayName: 'Amin K',
    };
    await upsertWorkspaceIntegration(
      db,
      makeIntegration({
        id: 'jira-1' as WorkspaceIntegrationId,
        provider: 'jira',
        config: jiraConfig,
        credentialId: 'cred-jira' as IntegrationCredentialId,
      }),
    );

    const got = await getWorkspaceIntegration(db, projectId, 'jira');
    expect(got!.provider).toBe('jira');
    expect((got!.config as JiraIntegrationConfig).siteUrl).toBe('https://acme.atlassian.net');
    expect((got!.config as JiraIntegrationConfig).projectKey).toBe('GB');
    expect(got!.credentialId).toBe('cred-jira');
  });
});
