import { describe, expect, it } from 'vitest';
import type { IsoDateTime, ProjectId, ProjectSentryLink, WorkspaceId } from '@goodboy/types';
import type { Database } from '../client';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import {
  addProjectSentryLink,
  listProjectSentryLinks,
  removeProjectSentryLink,
} from './project-sentry-link';

const WORKSPACE = 'workspace' as WorkspaceId;
const PAYMENTS = 'payments' as ProjectId;
const STOREFRONT = 'storefront' as ProjectId;

const seed = async (): Promise<Database> => {
  const db = await makeMigratedTestDatabase();
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Harborline', 'harborline', 1, 1)",
  );
  await db.execute(
    `INSERT INTO projects (id, workspace_id, name, root_path, kind, created_at, updated_at)
     VALUES ('payments', 'workspace', 'payments-api', '/repo/payments', 'repo', 1, 1),
            ('storefront', 'workspace', 'storefront-web', '/repo/storefront', 'repo', 1, 1)`,
  );
  return db;
};

const link = (patch: Partial<ProjectSentryLink>): ProjectSentryLink => ({
  id: 'link-1',
  workspaceId: WORKSPACE,
  projectId: PAYMENTS,
  sentryOrg: 'northwind',
  sentryProject: 'payments-api',
  sentryProjectName: 'payments-api',
  source: 'manual',
  createdAt: '2026-09-26T10:00:00.000Z' as IsoDateTime,
  ...patch,
});

describe('project sentry links', () => {
  it('links many sentry projects to one project and one sentry project to many', async () => {
    const db = await seed();

    await addProjectSentryLink({ db, link: link({}) });
    await addProjectSentryLink({
      db,
      link: link({ id: 'link-2', sentryProject: 'payments-worker', sentryProjectName: null }),
    });
    await addProjectSentryLink({
      db,
      link: link({ id: 'link-3', projectId: STOREFRONT, source: 'code_mapping' }),
    });

    const links = await listProjectSentryLinks({ db, workspaceId: WORKSPACE });
    expect(links.map((item) => [item.projectId, item.sentryProject, item.source])).toEqual([
      ['payments', 'payments-api', 'manual'],
      ['payments', 'payments-worker', 'manual'],
      ['storefront', 'payments-api', 'code_mapping'],
    ]);
    expect(links[0]?.createdAt).toBe('2026-09-26T10:00:00.000Z');
  });

  it('keeps one row when the same link is added twice', async () => {
    const db = await seed();

    await addProjectSentryLink({ db, link: link({}) });
    await addProjectSentryLink({
      db,
      link: link({ id: 'link-again', sentryProjectName: 'Payments' }),
    });

    const links = await listProjectSentryLinks({ db, workspaceId: WORKSPACE });
    expect(links).toHaveLength(1);
    expect(links[0]?.sentryProjectName).toBe('Payments');
  });

  it('removes one link and drops the rest with the project', async () => {
    const db = await seed();
    await addProjectSentryLink({ db, link: link({}) });
    await addProjectSentryLink({ db, link: link({ id: 'link-2', projectId: STOREFRONT }) });

    await removeProjectSentryLink({
      db,
      projectId: PAYMENTS,
      sentryOrg: 'northwind',
      sentryProject: 'payments-api',
    });
    await db.execute("DELETE FROM projects WHERE id = 'storefront'");

    expect(await listProjectSentryLinks({ db, workspaceId: WORKSPACE })).toEqual([]);
  });

  it('hides links of a disconnected project', async () => {
    const db = await seed();
    await addProjectSentryLink({ db, link: link({}) });
    await db.execute("UPDATE projects SET disconnected_at = 5 WHERE id = 'payments'");

    expect(await listProjectSentryLinks({ db, workspaceId: WORKSPACE })).toEqual([]);
  });
});
