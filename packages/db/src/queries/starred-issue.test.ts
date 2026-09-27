import { describe, expect, it } from 'vitest';
import type { IsoDateTime, StarredIssue, WorkspaceId } from '@goodboy/types';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import {
  listStarredIssues,
  starIssue,
  unstarClosedIssues,
  unstarIssue,
  updateStarredIssueSnapshots,
} from './starred-issue';

const WORKSPACE = 'harborline' as WorkspaceId;

const issue = (patch: Partial<StarredIssue>): StarredIssue => ({
  workspaceId: WORKSPACE,
  provider: 'linear',
  externalId: 'lin-1',
  identifier: 'CAS-231',
  container: null,
  title: 'Settle the month close',
  url: 'https://linear.app/cascadia/issue/CAS-231',
  state: 'open',
  stateLabel: 'Todo',
  starredAt: '2026-09-20T10:00:00.000Z' as IsoDateTime,
  refreshedAt: null,
  ...patch,
});

const seed = async () => {
  const db = await makeMigratedTestDatabase();
  await db.execute(
    `INSERT INTO workspaces (id, name, slug, created_at, updated_at)
     VALUES ('harborline', 'Harborline', 'harborline', 1, 1)`,
  );
  return db;
};

describe('starred issues', () => {
  it('stars once per workspace, provider and id, and unstars', async () => {
    const db = await seed();

    await starIssue({ db, issue: issue({}) });
    await starIssue({ db, issue: issue({ title: 'Settle the close' }) });
    await starIssue({
      db,
      issue: issue({
        provider: 'github',
        externalId: 'acme/storefront-web#482',
        identifier: '#482',
        container: 'acme/storefront-web',
      }),
    });

    const listed = await listStarredIssues({ db, workspaceId: WORKSPACE });
    expect(listed).toHaveLength(2);
    expect(listed.find((entry) => entry.provider === 'linear')?.title).toBe('Settle the close');

    await unstarIssue({ db, workspaceId: WORKSPACE, provider: 'linear', externalId: 'lin-1' });
    expect(await listStarredIssues({ db, workspaceId: WORKSPACE })).toHaveLength(1);
  });

  it('unstars only the closed ones and hands them back for undo', async () => {
    const db = await seed();
    await starIssue({ db, issue: issue({}) });
    await starIssue({
      db,
      issue: issue({ externalId: 'lin-2', state: 'done', stateLabel: 'Done' }),
    });

    const removed = await unstarClosedIssues({ db, workspaceId: WORKSPACE });

    expect(removed.map((entry) => entry.externalId)).toEqual(['lin-2']);
    expect(
      (await listStarredIssues({ db, workspaceId: WORKSPACE })).map((e) => e.externalId),
    ).toEqual(['lin-1']);
  });

  it('refreshes the snapshot and goes with the workspace', async () => {
    const db = await seed();
    await starIssue({ db, issue: issue({}) });

    await updateStarredIssueSnapshots({
      db,
      issues: [
        issue({
          state: 'missing',
          stateLabel: null,
          refreshedAt: '2026-09-21T10:00:00.000Z' as IsoDateTime,
        }),
      ],
    });
    expect((await listStarredIssues({ db, workspaceId: WORKSPACE }))[0]?.state).toBe('missing');

    await db.execute("DELETE FROM workspaces WHERE id = 'harborline'");
    expect(await listStarredIssues({ db, workspaceId: WORKSPACE })).toEqual([]);
  });
});
