import { describe, expect, it } from 'vitest';
import { brandId, type ArtifactId } from '@goodboy/types';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { AUTO_SEED_NOW, seedAutoSession, seedPlanArtifact } from '../test-helpers/auto-seeds';
import { getArtifact, setArtifactStatus } from './artifact';
import { listArtifactRevisions, writeArtifactRevision } from './artifactRevision';

const planId = brandId<ArtifactId>({ value: 'plan-1' });
const otherPlanId = brandId<ArtifactId>({ value: 'plan-2' });

const world = async () => {
  const db = await makeMigratedTestDatabase();
  await seedAutoSession({ db, agentIds: ['agent-planner', 'agent-other'] });
  await seedPlanArtifact({ db, id: planId, agentId: 'agent-planner' });
  await seedPlanArtifact({
    db,
    id: otherPlanId,
    agentId: 'agent-other',
    title: 'Plan for payments-api',
  });
  return db;
};

type WriteParams = {
  readonly db: Awaited<ReturnType<typeof world>>;
  readonly artifactId?: ArtifactId;
  readonly expectedRevision?: number;
  readonly sourceText?: string;
};

const write = ({
  db,
  artifactId = planId,
  expectedRevision = 1,
  sourceText = '# Plan v2\n',
}: WriteParams) =>
  writeArtifactRevision({
    db,
    artifactId,
    expectedRevision,
    kind: 'plan',
    isActiveOnly: true,
    author: 'agent',
    ask: 'make step two smaller',
    sourceTurnId: 'turn-7',
    title: 'Plan for notify-relay',
    sourceText,
    metadata: {},
    nowMs: AUTO_SEED_NOW + 10,
  });

describe('writeArtifactRevision', () => {
  it('makes revision N+1 of the same artifact with its history row, in one step', async () => {
    const db = await world();
    expect(await write({ db })).toEqual({ kind: 'saved', revision: 2 });
    const artifact = await getArtifact({ db, artifactId: planId });
    expect(artifact).toMatchObject({
      id: planId,
      revision: 2,
      status: 'active',
      sourceText: '# Plan v2\n',
    });
    const history = await listArtifactRevisions({ db, artifactId: planId });
    expect(history.map((item) => [item.revision, item.author, item.ask])).toEqual([
      [2, 'agent', 'make step two smaller'],
      [1, 'agent', null],
    ]);
    const rows = await db.select<{ source_turn_id: string | null }>(
      'SELECT source_turn_id FROM session_artifacts WHERE id = ?',
      [planId],
    );
    expect(rows[0]?.source_turn_id).toBe('turn-7');
  });

  it('touches only the targeted artifact', async () => {
    const db = await world();
    await write({ db });
    const other = await getArtifact({ db, artifactId: otherPlanId });
    expect(other).toMatchObject({ revision: 1, title: 'Plan for payments-api' });
    expect(await listArtifactRevisions({ db, artifactId: otherPlanId })).toHaveLength(1);
  });

  it('answers conflict with the latest revision and writes nothing when the base moved', async () => {
    const db = await world();
    await write({ db });
    expect(await write({ db, expectedRevision: 1, sourceText: '# stale\n' })).toEqual({
      kind: 'conflict',
      revision: 2,
    });
    const artifact = await getArtifact({ db, artifactId: planId });
    expect(artifact?.sourceText).toBe('# Plan v2\n');
    expect(await listArtifactRevisions({ db, artifactId: planId })).toHaveLength(2);
  });

  it('writes nothing to an artifact that was discarded without a revision bump', async () => {
    const db = await world();
    await setArtifactStatus({ db, artifactId: planId, status: 'discarded', kind: 'plan' });
    expect(await write({ db })).toEqual({ kind: 'conflict', revision: 1 });
    expect(await listArtifactRevisions({ db, artifactId: planId })).toHaveLength(1);
  });

  it('reports a missing artifact', async () => {
    const db = await world();
    expect(await write({ db, artifactId: brandId<ArtifactId>({ value: 'gone' }) })).toEqual({
      kind: 'missing',
    });
  });

  it('rolls the revision back when the history row cannot be written', async () => {
    const db = await world();
    await db.exec(
      `CREATE TRIGGER fail_revision_insert BEFORE INSERT ON artifact_revisions
       WHEN NEW.revision = 2 BEGIN SELECT RAISE(ABORT, 'history write failed'); END`,
    );
    await expect(write({ db })).rejects.toThrow('history write failed');
    const artifact = await getArtifact({ db, artifactId: planId });
    expect(artifact).toMatchObject({
      revision: 1,
      sourceText: '# Plan\n\n- step one\n- step two\n',
    });
  });

  it('is replay safe: a second run of the same base does not bump again', async () => {
    const db = await world();
    await write({ db });
    await write({ db });
    const artifact = await getArtifact({ db, artifactId: planId });
    expect(artifact?.revision).toBe(2);
    expect(await listArtifactRevisions({ db, artifactId: planId })).toHaveLength(2);
  });
  it('restores an older revision as a new one by author restore, and keeps the latest on conflict', async () => {
    const db = await world();
    await write({ db });
    const restored = await writeArtifactRevision({
      db,
      artifactId: planId,
      expectedRevision: 2,
      author: 'restore',
      ask: 'Restored v1',
      title: 'Plan for notify-relay',
      sourceText: '# Plan\n\n- step one\n- step two\n',
      metadata: {},
      nowMs: AUTO_SEED_NOW + 20,
    });
    expect(restored).toEqual({ kind: 'saved', revision: 3 });
    const history = await listArtifactRevisions({ db, artifactId: planId });
    expect(history.map((item) => [item.revision, item.author, item.ask])).toEqual([
      [3, 'restore', 'Restored v1'],
      [2, 'agent', 'make step two smaller'],
      [1, 'agent', null],
    ]);
    const lateRestore = await writeArtifactRevision({
      db,
      artifactId: planId,
      expectedRevision: 2,
      author: 'restore',
      ask: 'Restored v1',
      title: 'Plan for notify-relay',
      sourceText: '# older\n',
      metadata: {},
      nowMs: AUTO_SEED_NOW + 30,
    });
    expect(lateRestore).toEqual({ kind: 'conflict', revision: 3 });
    expect((await getArtifact({ db, artifactId: planId }))?.sourceText).toBe(
      '# Plan\n\n- step one\n- step two\n',
    );
  });
});
