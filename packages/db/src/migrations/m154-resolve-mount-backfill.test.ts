import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrations } from './index';
import { migrate } from './runner';

const before = migrations.filter((migration) => migration.version < 154);

type Mount = {
  readonly id: string;
  readonly path: string | null;
  readonly lastPath?: string | null;
  readonly branch?: string;
  readonly isAttached?: number;
  readonly diskState?: string;
  readonly projectId?: string | null;
  readonly revision?: number;
};

const seed = async ({ mounts }: { readonly mounts: ReadonlyArray<Mount> }): Promise<Database> => {
  const db = makeTestDatabase();
  await migrate(db, before);
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Workspace', 'workspace', 1, 1)",
  );
  await db.execute(
    "INSERT INTO projects (id, workspace_id, name, root_path, kind, created_at, updated_at) VALUES ('project', 'workspace', 'Api', '/repo/api', 'repo', 1, 1)",
  );
  await db.execute(
    "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('session', 'workspace', 'Goal', 'idle', 1, 1)",
  );
  let index = 0;
  for (const mount of mounts) {
    await db.execute(
      `INSERT INTO session_worktrees (id, session_id, project_id, worktree_path, last_worktree_path, branch, parallel_index, mount_name, is_attached, disk_state, revision, created_at, updated_at)
       VALUES (?, 'session', ?, ?, ?, ?, ?, 'api', ?, ?, ?, 1, 1)`,
      [
        mount.id,
        mount.projectId === undefined ? 'project' : mount.projectId,
        mount.path,
        mount.lastPath === undefined ? mount.path : mount.lastPath,
        mount.branch ?? `ak/feat-${index}`,
        index,
        mount.isAttached ?? 1,
        mount.diskState ?? 'present',
        mount.revision ?? 7,
      ],
    );
    index += 1;
  }
  return db;
};

type AttemptSeed = {
  readonly db: Database;
  readonly id: string;
  readonly phase: string;
};

const seedAttempt = async ({ db, id, phase }: AttemptSeed): Promise<void> => {
  await db.execute(
    `INSERT INTO resolve_attempts (id, session_id, agent_id, pr_number, thread_ids_json, provider, model, phase, created_at)
     VALUES (?, 'session', ?, 12, '["PRRT_1"]', 'anthropic', 'recorded-model', ?, 1)`,
    [id, `agent-${id}`, phase],
  );
};

type CandidateSeed = {
  readonly db: Database;
  readonly id: string;
  readonly path: string;
  readonly state?: string;
};

const seedCandidate = async ({ db, id, path, state = 'ready' }: CandidateSeed): Promise<void> => {
  await db.execute(
    `INSERT INTO resolve_candidates (id, session_id, revision, base_sha, candidate_sha, worktree_path, state, created_at, updated_at)
     VALUES (?, 'session', 1, 'base', 'cand', ?, ?, 1, 1)`,
    [id, path, state],
  );
};

type PublicationSeed = {
  readonly db: Database;
  readonly id: string;
  readonly branch: string;
  readonly candidateIds: ReadonlyArray<string>;
  readonly phase?: string;
};

const seedPublication = async ({
  db,
  id,
  branch,
  candidateIds,
  phase = 'previewed',
}: PublicationSeed): Promise<void> => {
  await db.execute(
    `INSERT INTO resolve_publications (id, session_id, repo, pr_number, branch, target_ref, local_head, commit_shas_json, candidate_ids_json, approved_item_ids_json, requires_push, phase, created_at)
     VALUES (?, 'session', 'acme/api', 12, ?, ?, 'aaaa111', '["aaaa111"]', ?, '["item-a"]', 1, ?, 1)`,
    [id, branch, `refs/heads/${branch}`, JSON.stringify(candidateIds), phase],
  );
};

type TargetRow = {
  readonly mount_id: string | null;
  readonly mount_revision: number | null;
  readonly worktree_path: string | null;
};

const attemptTarget = async ({ db, id }: { readonly db: Database; readonly id: string }) =>
  db.select<TargetRow>(
    'SELECT mount_id, mount_revision, worktree_path FROM resolve_attempts WHERE id = ?',
    [id],
  );

const candidateTarget = async ({ db, id }: { readonly db: Database; readonly id: string }) =>
  db.select<TargetRow & { readonly state: string }>(
    'SELECT mount_id, mount_revision, worktree_path, state FROM resolve_candidates WHERE id = ?',
    [id],
  );

const publicationTarget = async ({ db, id }: { readonly db: Database; readonly id: string }) =>
  db.select<TargetRow & { readonly phase: string; readonly error: string | null }>(
    'SELECT mount_id, mount_revision, worktree_path, phase, error FROM resolve_publications WHERE id = ?',
    [id],
  );

const M0 = '/repo/api/.goodboy/worktrees/m0';
const M1 = '/repo/api/.goodboy/worktrees/m1';

describe('m154 resolve mount backfill', () => {
  it('associates a candidate whose path names exactly one mount of the session', async () => {
    const db = await seed({
      mounts: [
        { id: 'mount-0', path: M0 },
        { id: 'mount-1', path: M1 },
      ],
    });
    await seedCandidate({ db, id: 'candidate-a', path: M1 });

    await migrate(db);

    expect(await candidateTarget({ db, id: 'candidate-a' })).toEqual([
      { mount_id: 'mount-1', mount_revision: 7, worktree_path: M1, state: 'ready' },
    ]);
  });

  it('associates a candidate through the last path of a single detached mount', async () => {
    const db = await seed({
      mounts: [{ id: 'mount-0', path: null, lastPath: M0, isAttached: 0, diskState: 'removed' }],
    });
    await seedCandidate({ db, id: 'candidate-a', path: M0 });

    await migrate(db);

    expect((await candidateTarget({ db, id: 'candidate-a' }))[0]?.mount_id).toBe('mount-0');
  });

  it('leaves a candidate alone when two mounts share the last path it names', async () => {
    const db = await seed({
      mounts: [
        { id: 'mount-0', path: null, lastPath: M0, isAttached: 0, diskState: 'removed' },
        { id: 'mount-1', path: M1, lastPath: M0 },
      ],
    });
    await seedCandidate({ db, id: 'candidate-a', path: M0 });

    await migrate(db);

    expect((await candidateTarget({ db, id: 'candidate-a' }))[0]).toMatchObject({
      mount_id: null,
      state: 'stale',
    });
  });

  it('takes an attempt target from the candidate that carries its id', async () => {
    const db = await seed({
      mounts: [
        { id: 'mount-0', path: M0 },
        { id: 'mount-1', path: M1 },
      ],
    });
    await seedAttempt({ db, id: 'attempt-a', phase: 'finished' });
    await seedCandidate({ db, id: 'attempt-a', path: M1 });

    await migrate(db);

    expect(await attemptTarget({ db, id: 'attempt-a' })).toEqual([
      { mount_id: 'mount-1', mount_revision: 7, worktree_path: M1 },
    ]);
  });

  it('associates a candidateless attempt only when the session had one writable mount', async () => {
    const db = await seed({ mounts: [{ id: 'mount-0', path: M0 }] });
    await seedAttempt({ db, id: 'attempt-a', phase: 'finished' });

    await migrate(db);

    expect(await attemptTarget({ db, id: 'attempt-a' })).toEqual([
      { mount_id: 'mount-0', mount_revision: 7, worktree_path: M0 },
    ]);
  });

  it('refuses to pick between two writable mounts for a candidateless attempt', async () => {
    const db = await seed({
      mounts: [
        { id: 'mount-0', path: M0 },
        { id: 'mount-1', path: M1 },
      ],
    });
    await seedAttempt({ db, id: 'attempt-a', phase: 'queued' });

    await migrate(db);

    expect(await attemptTarget({ db, id: 'attempt-a' })).toEqual([
      { mount_id: null, mount_revision: null, worktree_path: null },
    ]);
    expect(
      await db.select<{ readonly phase: string }>(
        "SELECT phase FROM resolve_attempts WHERE id = 'attempt-a'",
      ),
    ).toEqual([{ phase: 'queued' }]);
  });

  it('associates a publication when every candidate it includes names the same mount', async () => {
    const db = await seed({
      mounts: [
        { id: 'mount-0', path: M0 },
        { id: 'mount-1', path: M1 },
      ],
    });
    await seedCandidate({ db, id: 'candidate-a', path: M1 });
    await seedCandidate({ db, id: 'candidate-b', path: M1 });
    await seedPublication({
      db,
      id: 'publication-a',
      branch: 'ak/feat-1',
      candidateIds: ['candidate-a', 'candidate-b'],
    });

    await migrate(db);

    expect(await publicationTarget({ db, id: 'publication-a' })).toEqual([
      {
        mount_id: 'mount-1',
        mount_revision: 7,
        worktree_path: M1,
        phase: 'previewed',
        error: null,
      },
    ]);
  });

  it('refuses a publication whose candidates name two different mounts', async () => {
    const db = await seed({
      mounts: [
        { id: 'mount-0', path: M0 },
        { id: 'mount-1', path: M1 },
      ],
    });
    await seedCandidate({ db, id: 'candidate-a', path: M0 });
    await seedCandidate({ db, id: 'candidate-b', path: M1 });
    await seedPublication({
      db,
      id: 'publication-a',
      branch: 'ak/feat-1',
      candidateIds: ['candidate-a', 'candidate-b'],
    });

    await migrate(db);

    expect(await publicationTarget({ db, id: 'publication-a' })).toEqual([
      {
        mount_id: null,
        mount_revision: null,
        worktree_path: null,
        phase: 'failed',
        error: 'target_unresolved',
      },
    ]);
  });

  it('associates a candidateless publication through a single mount on its branch', async () => {
    const db = await seed({
      mounts: [
        { id: 'mount-0', path: M0, branch: 'ak/other' },
        { id: 'mount-1', path: M1, branch: 'ak/publish' },
      ],
    });
    await seedPublication({ db, id: 'publication-a', branch: 'ak/publish', candidateIds: [] });

    await migrate(db);

    expect((await publicationTarget({ db, id: 'publication-a' }))[0]).toMatchObject({
      mount_id: 'mount-1',
      worktree_path: M1,
      phase: 'previewed',
    });
  });

  it('refuses a publication when two mounts sit on its branch', async () => {
    const db = await seed({
      mounts: [
        { id: 'mount-0', path: M0, branch: 'ak/publish' },
        { id: 'mount-1', path: M1, branch: 'ak/publish' },
      ],
    });
    await seedPublication({ db, id: 'publication-a', branch: 'ak/publish', candidateIds: [] });

    await migrate(db);

    expect((await publicationTarget({ db, id: 'publication-a' }))[0]).toMatchObject({
      mount_id: null,
      phase: 'failed',
    });
  });

  it('leaves a finished publication and an integrated candidate untouched', async () => {
    const db = await seed({
      mounts: [
        { id: 'mount-0', path: M0 },
        { id: 'mount-1', path: M1 },
      ],
    });
    await seedCandidate({ db, id: 'candidate-a', path: '/repo/api/gone', state: 'integrated' });
    await seedPublication({
      db,
      id: 'publication-a',
      branch: 'ak/nothing',
      candidateIds: ['candidate-a'],
      phase: 'finished',
    });

    await migrate(db);

    expect((await candidateTarget({ db, id: 'candidate-a' }))[0]).toMatchObject({
      mount_id: null,
      state: 'integrated',
    });
    expect((await publicationTarget({ db, id: 'publication-a' }))[0]).toMatchObject({
      mount_id: null,
      phase: 'finished',
      error: null,
    });
  });

  it('deletes no record it could not associate', async () => {
    const db = await seed({
      mounts: [
        { id: 'mount-0', path: M0 },
        { id: 'mount-1', path: M1 },
      ],
    });
    await seedAttempt({ db, id: 'attempt-a', phase: 'running' });
    await seedCandidate({ db, id: 'candidate-a', path: '/repo/api/gone', state: 'building' });
    await seedPublication({
      db,
      id: 'publication-a',
      branch: 'ak/nothing',
      candidateIds: ['candidate-a'],
    });

    await migrate(db);

    expect(
      await db.select<{ readonly attempts: number }>(
        'SELECT COUNT(*) AS attempts FROM resolve_attempts',
      ),
    ).toEqual([{ attempts: 1 }]);
    expect((await candidateTarget({ db, id: 'candidate-a' }))[0]?.state).toBe('stale');
    expect((await publicationTarget({ db, id: 'publication-a' }))[0]?.phase).toBe('failed');
  });

  it('applies in a single transactional segment', async () => {
    const db = await seed({ mounts: [{ id: 'mount-0', path: M0 }] });

    await migrate(db);

    expect(
      await db.select<{ readonly segments: number }>(
        'SELECT COUNT(*) AS segments FROM schema_migration_segment WHERE version = 154',
      ),
    ).toEqual([{ segments: 0 }]);
    expect(
      await db.select<{ readonly version: number }>(
        'SELECT version FROM schema_version WHERE version = 154',
      ),
    ).toEqual([{ version: 154 }]);
  });
});
