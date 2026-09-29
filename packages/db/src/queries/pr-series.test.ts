import { beforeEach, describe, expect, it } from 'vitest';
import type {
  IsoDateTime,
  MountId,
  PrSeries,
  PrSeriesId,
  PrSeriesMember,
  PrSeriesMemberId,
  ProjectId,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import type { Database } from '../client';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { insertSessionWorktree } from './session-worktree';
import { upsertMountPullRequestLink } from './mount-pr-link';
import {
  findPrSeriesMembership,
  getPrSeries,
  insertPrSeries,
  listPrSeries,
  listPrSeriesMembers,
  upsertPrSeriesMember,
} from './pr-series';

const workspaceId = 'workspace' as WorkspaceId;
const sessionId = 'session' as SessionId;
const projectId = 'project' as ProjectId;
const seriesId = 'series' as PrSeriesId;
const now = Date.parse('2026-09-08T10:00:00.000Z');
const iso = new Date(now).toISOString() as IsoDateTime;

const seed = async (): Promise<Database> => {
  const db = await makeMigratedTestDatabase();
  await db.execute(
    'INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [workspaceId, 'Workspace', 'workspace', now, now],
  );
  await db.execute(
    `INSERT INTO projects (id, workspace_id, name, root_path, kind, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [projectId, workspaceId, 'admin', '/repo/admin', 'repo', now, now],
  );
  await db.execute(
    `INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at)
     VALUES (?, ?, 'Split the restyle', 'idle', ?, ?)`,
    [sessionId, workspaceId, now, now],
  );
  return db;
};

const seedMount = async ({
  db,
  id,
  branch,
}: {
  readonly db: Database;
  readonly id: string;
  readonly branch: string;
}): Promise<MountId> => {
  await insertSessionWorktree(db, {
    id,
    sessionId,
    worktreePath: `/mount/${id}`,
    branch,
    parallelIndex: 0,
    projectId,
    repoSlug: 'acme/admin',
    createdAt: now,
  });
  return id as MountId;
};

const series = (overrides: Partial<PrSeries> = {}): PrSeries => ({
  id: seriesId,
  sessionId,
  projectId,
  name: 'restyle',
  workItemIdentifier: null,
  workItemUrl: null,
  plannedCount: 6,
  parentRequest: null,
  createdAt: iso,
  updatedAt: iso,
  ...overrides,
});

const member = (overrides: Partial<PrSeriesMember> = {}): PrSeriesMember => ({
  id: 'member' as PrSeriesMemberId,
  seriesId,
  mountId: null,
  branch: null,
  ordinal: 1,
  label: '1/6',
  status: 'planned',
  createdAt: iso,
  updatedAt: iso,
  ...overrides,
});

let db: Database;

beforeEach(async () => {
  db = await seed();
});

describe('pr series', () => {
  it('holds four created positions and two planned ones in one flat series', async () => {
    await insertPrSeries({ db, series: series() });
    const branches = [
      'ak/admin-ds-foundations',
      'ak/admin-patients-search-landing',
      'ak/admin-patient-header',
      'ak/admin-patient-paths',
    ];
    for (const [index, branch] of branches.entries()) {
      const mountId = await seedMount({ db, id: `mount-${index + 1}`, branch });
      await upsertPrSeriesMember({
        db,
        member: member({
          id: `created-${index + 1}` as PrSeriesMemberId,
          mountId,
          branch,
          ordinal: index + 1,
          label: `${index + 1}/6`,
          status: 'active',
        }),
      });
    }
    for (const ordinal of [5, 6]) {
      await upsertPrSeriesMember({
        db,
        member: member({
          id: `planned-${ordinal}` as PrSeriesMemberId,
          ordinal,
          label: `${ordinal}/6`,
        }),
      });
    }

    const [view] = await listPrSeries({ db, sessionId });

    expect(view?.members.map((entry) => entry.ordinal)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(view?.members.filter((entry) => entry.status === 'active')).toHaveLength(4);
    expect(view?.members.filter((entry) => entry.mountId === null)).toHaveLength(2);
  });

  it('keeps an explicitly supplied parent request as a provider identity', async () => {
    await insertPrSeries({
      db,
      series: series({
        parentRequest: {
          provider: 'github',
          host: 'github.com',
          repoSlug: 'acme/admin',
          prNumber: 190,
        },
      }),
    });

    const stored = await getPrSeries({ db, sessionId, seriesId });

    expect(stored?.parentRequest).toEqual({
      provider: 'github',
      host: 'github.com',
      repoSlug: 'acme/admin',
      prNumber: 190,
    });
  });

  it('refuses a second member at a position the series already fills', async () => {
    await insertPrSeries({ db, series: series() });
    await upsertPrSeriesMember({ db, member: member({ ordinal: 3, id: 'a' as PrSeriesMemberId }) });

    await db
      .execute(
        `INSERT INTO pr_series_members
        (id, series_id, mount_id, branch, ordinal, label, status, created_at, updated_at)
       VALUES (?, ?, NULL, NULL, 3, '3/6', 'planned', ?, ?)`,
        ['b', seriesId, now, now],
      )
      .then(
        () => expect.unreachable('a duplicate ordinal must not land'),
        (error: unknown) => expect(String(error)).toMatch(/UNIQUE|constraint/i),
      );
  });

  it('refuses a position that is not a positive number', async () => {
    await insertPrSeries({ db, series: series() });

    await upsertPrSeriesMember({ db, member: member({ ordinal: 0 }) }).then(
      () => expect.unreachable('a zero position must not land'),
      (error: unknown) => expect(String(error)).toMatch(/constraint/i),
    );
  });

  it('resolves the request of a member through its mount and its branch snapshot', async () => {
    await insertPrSeries({ db, series: series() });
    const mountId = await seedMount({ db, id: 'mount-1', branch: 'ak/admin-patient-header' });
    await upsertMountPullRequestLink({
      db,
      sessionId,
      link: {
        id: 'link-1',
        mountId,
        provider: 'github',
        host: 'github.com',
        repoSlug: 'acme/admin',
        prNumber: 212,
        headBranch: 'ak/admin-patient-header',
        baseBranch: 'main',
        url: 'https://github.com/acme/admin/pull/212',
        state: 'open',
        snapshot: null,
        lastObservedAt: iso,
        createdAt: iso,
        updatedAt: iso,
      },
    });
    await upsertPrSeriesMember({
      db,
      member: member({
        mountId,
        branch: 'ak/admin-patient-header',
        ordinal: 3,
        label: '3/6',
        status: 'active',
      }),
    });

    const [view] = await listPrSeries({ db, sessionId });

    expect(view?.members[0]?.request?.prNumber).toBe(212);
  });

  it('keeps an earlier membership on its own branch after the mount switches away', async () => {
    await insertPrSeries({ db, series: series() });
    const mountId = await seedMount({ db, id: 'mount-1', branch: 'ak/admin-patient-header' });
    await upsertPrSeriesMember({
      db,
      member: member({
        mountId,
        branch: 'ak/admin-patient-header',
        ordinal: 3,
        label: '3/6',
        status: 'active',
      }),
    });

    await db.execute('UPDATE session_worktrees SET branch = ? WHERE id = ?', [
      'ak/admin-patient-paths',
      mountId,
    ]);
    const [view] = await listPrSeries({ db, sessionId });

    expect(view?.members[0]?.branch).toBe('ak/admin-patient-header');
    expect(view?.members[0]?.ordinal).toBe(3);
  });

  it('leaves an omitted position out of the branches a creation consults', async () => {
    await insertPrSeries({ db, series: series() });
    const mountId = await seedMount({ db, id: 'mount-1', branch: 'ak/admin-patient-header' });
    await upsertPrSeriesMember({
      db,
      member: member({
        mountId,
        branch: 'ak/admin-patient-header',
        ordinal: 3,
        label: '3/6',
        status: 'omitted',
      }),
    });

    const membership = await findPrSeriesMembership({
      db,
      sessionId,
      mountId,
      branch: 'ak/admin-patient-header',
    });

    expect(membership).toBeNull();
  });

  it('finds the series a mount and branch belong to', async () => {
    await insertPrSeries({ db, series: series({ workItemIdentifier: 'ENG-3240' }) });
    const mountId = await seedMount({ db, id: 'mount-1', branch: 'ak/admin-patient-header' });
    await upsertPrSeriesMember({
      db,
      member: member({
        mountId,
        branch: 'ak/admin-patient-header',
        ordinal: 3,
        label: '3/6',
        status: 'active',
      }),
    });

    const membership = await findPrSeriesMembership({
      db,
      sessionId,
      mountId,
      branch: 'ak/admin-patient-header',
    });

    expect(membership?.series.workItemIdentifier).toBe('ENG-3240');
    expect(membership?.member.ordinal).toBe(3);
  });

  it('lists several series with only their own members in position order', async () => {
    const otherId = 'series-b' as PrSeriesId;
    await insertPrSeries({ db, series: series() });
    await insertPrSeries({
      db,
      series: series({
        id: otherId,
        name: 'follow-up',
        createdAt: new Date(now + 1).toISOString() as IsoDateTime,
      }),
    });
    await upsertPrSeriesMember({
      db,
      member: member({ id: 'm-a2' as PrSeriesMemberId, ordinal: 2, label: '2/6' }),
    });
    await upsertPrSeriesMember({
      db,
      member: member({ id: 'm-a1' as PrSeriesMemberId, ordinal: 1 }),
    });
    await upsertPrSeriesMember({
      db,
      member: member({ id: 'm-b1' as PrSeriesMemberId, seriesId: otherId, ordinal: 1 }),
    });

    const listed = await listPrSeries({ db, sessionId });

    expect(listed.map((view) => [view.id, view.members.map((entry) => entry.id)])).toEqual([
      [seriesId, ['m-a1', 'm-a2']],
      [otherId, ['m-b1']],
    ]);
  });
});

describe('finding a series membership', () => {
  const branch = 'ak/admin-patient-header';
  const otherSessionId = 'session-other' as SessionId;
  const laterId = 'series-later' as PrSeriesId;
  const omittedId = 'series-omitted' as PrSeriesId;
  const foreignId = 'series-foreign' as PrSeriesId;

  const seedCrowdedMount = async (): Promise<MountId> => {
    const mountId = await seedMount({ db, id: 'mount-1', branch });
    await db.execute(
      `INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at)
       VALUES (?, ?, 'Another split', 'idle', ?, ?)`,
      [otherSessionId, workspaceId, now, now],
    );
    await insertPrSeries({
      db,
      series: series({ id: foreignId, sessionId: otherSessionId, name: 'foreign' }),
    });
    await insertPrSeries({ db, series: series({ workItemIdentifier: 'ENG-3240' }) });
    await insertPrSeries({ db, series: series({ id: laterId, name: 'later' }) });
    await insertPrSeries({ db, series: series({ id: omittedId, name: 'omitted' }) });
    const entries = [
      { id: 'm-foreign', seriesId: foreignId, ordinal: 1, status: 'active' as const },
      { id: 'm-omitted', seriesId: omittedId, ordinal: 1, status: 'omitted' as const },
      { id: 'm-first', seriesId, ordinal: 2, status: 'active' as const },
      { id: 'm-later', seriesId: laterId, ordinal: 3, status: 'planned' as const },
    ];
    for (const entry of entries) {
      await upsertPrSeriesMember({
        db,
        member: member({
          id: entry.id as PrSeriesMemberId,
          seriesId: entry.seriesId,
          ordinal: entry.ordinal,
          status: entry.status,
          label: `${entry.ordinal}/6`,
          mountId,
          branch,
        }),
      });
    }
    return mountId;
  };

  type LegacyParams = {
    readonly db: Database;
    readonly sessionId: SessionId;
    readonly mountId: MountId;
    readonly branch: string;
  };

  const legacyMembership = async (params: LegacyParams) => {
    const rows = await params.db.select<{ readonly id: string; readonly seriesId: PrSeriesId }>(
      `SELECT id, series_id AS seriesId FROM pr_series_members
       WHERE mount_id = ? AND branch = ? AND status != 'omitted'
       ORDER BY ordinal`,
      [params.mountId, params.branch],
    );
    for (const row of rows) {
      const found = await getPrSeries({
        db: params.db,
        sessionId: params.sessionId,
        seriesId: row.seriesId,
      });
      if (found !== null) {
        const members = await listPrSeriesMembers({ db: params.db, seriesId: row.seriesId });
        return { series: found, member: members.find((entry) => entry.id === row.id) };
      }
    }
    return null;
  };

  it('returns what one query per candidate row used to return', async () => {
    const mountId = await seedCrowdedMount();
    const lookups: ReadonlyArray<LegacyParams> = [
      { db, sessionId, mountId, branch },
      { db, sessionId: otherSessionId, mountId, branch },
      { db, sessionId, mountId, branch: 'ak/admin-other' },
      { db, sessionId: 'session-unknown' as SessionId, mountId, branch },
    ];

    for (const lookup of lookups) {
      const found = await findPrSeriesMembership(lookup);
      expect(found).toEqual(await legacyMembership(lookup));
    }
    const own = await findPrSeriesMembership({ db, sessionId, mountId, branch });
    expect(own?.member.id).toBe('m-first');
    expect(own?.series.workItemIdentifier).toBe('ENG-3240');
    const foreign = await findPrSeriesMembership({
      db,
      sessionId: otherSessionId,
      mountId,
      branch,
    });
    expect(foreign?.member.id).toBe('m-foreign');
  });

  it('asks the database once however many members sit on the branch', async () => {
    const mountId = await seedCrowdedMount();
    let selects = 0;
    const counting: Database = {
      exec: (sql) => db.exec(sql),
      execute: (sql, params) => db.execute(sql, params),
      select: <T>(sql: string, params?: ReadonlyArray<unknown>) => {
        selects += 1;
        return db.select<T>(sql, params);
      },
      transaction: (params) => db.transaction(params),
    };

    const found = await findPrSeriesMembership({ db: counting, sessionId, mountId, branch });

    expect(found?.member.id).toBe('m-first');
    expect(selects).toBe(1);
  });
});
