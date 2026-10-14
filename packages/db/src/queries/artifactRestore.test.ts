import { describe, expect, it } from 'vitest';
import { brandId, type ArtifactId } from '@goodboy/types';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { AUTO_SEED_NOW, seedAutoSession, seedPlanArtifact } from '../test-helpers/auto-seeds';
import { getArtifact } from './artifact';
import {
  listArtifactRevisions,
  restoreArtifactToRevision,
  writeArtifactRevision,
} from './artifactRevision';

const planId = brandId<ArtifactId>({ value: 'plan-1' });
const PARTS = { clusters: [{ title: 'part a', instructions: 'a' }] };

const world = async () => {
  const db = await makeMigratedTestDatabase();
  await seedAutoSession({ db, agentIds: ['agent-planner'] });
  await seedPlanArtifact({ db, id: planId, agentId: 'agent-planner' });
  const second = await writeArtifactRevision({
    db,
    artifactId: planId,
    expectedRevision: 1,
    author: 'agent',
    title: 'Plan with parts',
    sourceText: '# Plan v2\n',
    metadata: PARTS,
    nowMs: AUTO_SEED_NOW + 10,
  });
  expect(second).toEqual({ kind: 'saved', revision: 2 });
  const third = await writeArtifactRevision({
    db,
    artifactId: planId,
    expectedRevision: 2,
    author: 'user',
    title: 'Plan by hand',
    sourceText: '# Plan v3\n',
    metadata: {},
    nowMs: AUTO_SEED_NOW + 20,
  });
  expect(third).toEqual({ kind: 'saved', revision: 3 });
  return db;
};

describe('restoring an artifact to an earlier revision', () => {
  it('writes the title, text and metadata of that revision as a new one by author restore', async () => {
    const db = await world();

    const outcome = await restoreArtifactToRevision({
      db,
      artifactId: planId,
      expectedRevision: 3,
      revision: 2,
      nowMs: AUTO_SEED_NOW + 30,
    });

    expect(outcome).toEqual({ kind: 'restored', revision: 4 });
    expect(await getArtifact({ db, artifactId: planId })).toMatchObject({
      revision: 4,
      title: 'Plan with parts',
      sourceText: '# Plan v2\n',
      metadata: PARTS,
    });
    const history = await listArtifactRevisions({ db, artifactId: planId });
    expect(history[0]).toMatchObject({ revision: 4, author: 'restore', ask: 'Restored v2' });
    expect(history[0]?.metadata).toEqual(PARTS);
  });

  it('keeps the latest version when a newer one arrived, and writes nothing', async () => {
    const db = await world();

    const outcome = await restoreArtifactToRevision({
      db,
      artifactId: planId,
      expectedRevision: 2,
      revision: 1,
      nowMs: AUTO_SEED_NOW + 30,
    });

    expect(outcome).toEqual({ kind: 'conflict', revision: 3 });
    expect(await getArtifact({ db, artifactId: planId })).toMatchObject({
      revision: 3,
      sourceText: '# Plan v3\n',
    });
    expect(await listArtifactRevisions({ db, artifactId: planId })).toHaveLength(3);
  });

  it('reports a revision that is not in the history and an artifact that is gone', async () => {
    const db = await world();

    expect(
      await restoreArtifactToRevision({
        db,
        artifactId: planId,
        expectedRevision: 3,
        revision: 9,
        nowMs: AUTO_SEED_NOW + 30,
      }),
    ).toEqual({ kind: 'missing_revision' });
    expect(
      await restoreArtifactToRevision({
        db,
        artifactId: brandId<ArtifactId>({ value: 'plan-gone' }),
        expectedRevision: 1,
        revision: 1,
        nowMs: AUTO_SEED_NOW + 30,
      }),
    ).toEqual({ kind: 'missing_revision' });
    expect(await listArtifactRevisions({ db, artifactId: planId })).toHaveLength(3);
  });

  it('is replay safe: a second restore from the same base does not bump again', async () => {
    const db = await world();
    const params = {
      db,
      artifactId: planId,
      expectedRevision: 3,
      revision: 2,
      nowMs: AUTO_SEED_NOW + 30,
    };
    await restoreArtifactToRevision(params);

    const again = await restoreArtifactToRevision(params);

    expect(again).toEqual({ kind: 'conflict', revision: 4 });
    expect(await listArtifactRevisions({ db, artifactId: planId })).toHaveLength(4);
  });
});
