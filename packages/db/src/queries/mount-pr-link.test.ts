import { describe, expect, it } from 'vitest';
import type {
  IsoDateTime,
  MountId,
  MountPullRequestLink,
  ProjectId,
  SessionId,
} from '@goodboy/types';
import type { Database } from '../client';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import {
  listMergedRequestHeads,
  listMountPullRequestLinks,
  upsertMountPullRequestLink,
} from './mount-pr-link';
import { insertSessionWorktree } from './session-worktree';

const sessionId = 'session' as SessionId;
const mountId = 'mount' as MountId;
const projectId = 'ledger' as ProjectId;
const at = (ms: number): IsoDateTime => new Date(ms).toISOString() as IsoDateTime;

const seed = async (): Promise<Database> => {
  const db = await makeMigratedTestDatabase();
  await db.execute(
    'INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    ['workspace', 'Harborline', '/tmp/harborline', 1, 1],
  );
  await db.execute(
    `INSERT INTO projects (id, workspace_id, name, root_path, kind, created_at, updated_at)
     VALUES (?, 'workspace', 'ledger-core', '/repos/ledger-core', 'repo', 1, 1)`,
    [projectId],
  );
  await db.execute(
    'INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [sessionId, 'workspace', 'Close the ledger month', 'idle', 1, 1],
  );
  await insertSessionWorktree(db, {
    id: mountId,
    sessionId,
    projectId,
    worktreePath: '/tmp/wt/ledger',
    branch: 'goodboy/ledger-close',
    parallelIndex: 0,
    createdAt: 1,
  });
  return db;
};

const link = (patch: Partial<MountPullRequestLink>): MountPullRequestLink => ({
  id: 'link-1',
  mountId,
  provider: 'github',
  host: 'github.com',
  repoSlug: 'harborline/ledger-core',
  prNumber: 12,
  headBranch: 'goodboy/ledger-close',
  baseBranch: 'main',
  url: 'https://github.com/harborline/ledger-core/pull/12',
  state: 'open',
  snapshot: {},
  lastObservedAt: at(2),
  createdAt: at(1),
  updatedAt: at(2),
  ...patch,
});

describe('mount pull request merged head', () => {
  it('records the merged head and keeps it when a later poll has none', async () => {
    const db = await seed();
    await upsertMountPullRequestLink({ db, sessionId, link: link({}) });
    await upsertMountPullRequestLink({
      db,
      sessionId,
      link: link({ state: 'merged', mergedHeadSha: 'abc123', mergedAt: at(5) }),
    });
    await upsertMountPullRequestLink({ db, sessionId, link: link({ state: 'merged' }) });

    const [stored] = await listMountPullRequestLinks({ db, sessionId, mountId });

    expect(stored?.mergedHeadSha).toBe('abc123');
    expect(stored?.mergedAt).toBe(at(5));
  });

  it('lists merged heads by branch for a project', async () => {
    const db = await seed();
    await upsertMountPullRequestLink({
      db,
      sessionId,
      link: link({ state: 'merged', mergedHeadSha: 'abc123', mergedAt: at(5) }),
    });
    await upsertMountPullRequestLink({
      db,
      sessionId,
      link: link({ id: 'link-2', prNumber: 13, headBranch: 'goodboy/fx-rates' }),
    });

    expect(await listMergedRequestHeads({ db, projectId })).toEqual({
      'goodboy/ledger-close': 'abc123',
    });
  });
});
