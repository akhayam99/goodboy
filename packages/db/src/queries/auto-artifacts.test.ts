import { describe, expect, it } from 'vitest';
import {
  brandId,
  type AgentId,
  type ArtifactId,
  type AutoAttemptId,
  type AutoDelegationId,
  type AutoTreeId,
} from '@goodboy/types';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import {
  AUTO_SEED_NOW,
  seedAutoSession,
  seedAutoTree,
  seedPlanArtifact,
} from '../test-helpers/auto-seeds';
import { writeArtifactRevision } from './artifactRevision';
import {
  approveAutoArtifact,
  finishAutoArtifactReviseStatement,
  getAutoArtifact,
  insertAutoArtifactVersionStatement,
  listAutoArtifacts,
  listAutoArtifactVersions,
  registerAutoArtifact,
} from './auto-artifacts';
import { setArtifactStatus } from './artifact';

const treeId = brandId<AutoTreeId>({ value: 'tree-1' });
const planId = brandId<ArtifactId>({ value: 'plan-1' });

const world = async () => {
  const db = await makeMigratedTestDatabase();
  await seedAutoSession({ db, agentIds: ['agent-planner'] });
  await seedAutoTree({ db });
  await seedPlanArtifact({ db, id: planId, agentId: 'agent-planner' });
  await registerAutoArtifact({
    db,
    artifact: {
      artifactId: planId,
      treeId,
      kind: 'plan',
      ownerAgentId: brandId<AgentId>({ value: 'agent-planner' }),
      ownerDelegationId: brandId<AutoDelegationId>({ value: 'delegation-1' }),
      ownerRole: 'planner',
      nowMs: AUTO_SEED_NOW,
    },
  });
  return db;
};

describe('auto artifacts', () => {
  it('registers an artifact once and starts it as needing approval', async () => {
    const db = await world();
    const again = await registerAutoArtifact({
      db,
      artifact: {
        artifactId: planId,
        treeId,
        kind: 'plan',
        ownerAgentId: brandId<AgentId>({ value: 'agent-planner' }),
        ownerDelegationId: brandId<AutoDelegationId>({ value: 'delegation-2' }),
        ownerRole: 'planner',
        nowMs: AUTO_SEED_NOW,
      },
    });
    expect(again.isCreated).toBe(false);
    expect(again.artifact).toMatchObject({
      approvalState: 'needs_approval',
      approvedRevision: null,
      openReviseDelegationId: null,
      ownerDelegationId: 'delegation-1',
    });
    expect(await listAutoArtifacts({ db, treeId })).toHaveLength(1);
  });

  it('approves the revision it was shown and nothing else', async () => {
    const db = await world();
    expect(await approveAutoArtifact({ db, artifactId: planId, expectedRevision: 2 })).toEqual({
      kind: 'stale_revision',
      revision: 1,
    });
    expect(await approveAutoArtifact({ db, artifactId: planId, expectedRevision: 1 })).toEqual({
      kind: 'approved',
      revision: 1,
    });
    expect(await getAutoArtifact({ db, artifactId: planId })).toMatchObject({
      approvalState: 'approved',
      approvedRevision: 1,
    });
  });

  it('refuses to approve while a revise is open, after a discard, and for an unknown artifact', async () => {
    const db = await world();
    await db.execute(
      "UPDATE auto_artifacts SET approval_state = 'revising', open_revise_delegation_id = 'delegation-9' WHERE artifact_id = ?",
      [planId],
    );
    expect(await approveAutoArtifact({ db, artifactId: planId, expectedRevision: 1 })).toEqual({
      kind: 'revising',
      revision: 1,
    });
    await db.execute(
      "UPDATE auto_artifacts SET approval_state = 'needs_approval', open_revise_delegation_id = NULL WHERE artifact_id = ?",
      [planId],
    );
    await setArtifactStatus({ db, artifactId: planId, status: 'discarded', kind: 'plan' });
    expect(await approveAutoArtifact({ db, artifactId: planId, expectedRevision: 1 })).toEqual({
      kind: 'discarded',
      revision: 1,
    });
    expect(
      await approveAutoArtifact({
        db,
        artifactId: brandId<ArtifactId>({ value: 'nope' }),
        expectedRevision: 1,
      }),
    ).toEqual({ kind: 'unknown' });
  });

  it('records which attempt wrote which revision, once per attempt', async () => {
    const db = await world();
    const written = await writeArtifactRevision({
      db,
      artifactId: planId,
      expectedRevision: 1,
      author: 'agent',
      ask: 'make step two smaller',
      title: 'Plan for notify-relay',
      sourceText: '# Plan v2\n',
      metadata: {},
      nowMs: AUTO_SEED_NOW + 1,
    });
    expect(written).toEqual({ kind: 'saved', revision: 2 });
    const version = insertAutoArtifactVersionStatement({
      artifactId: planId,
      delegationId: brandId<AutoDelegationId>({ value: 'delegation-3' }),
      attemptId: brandId<AutoAttemptId>({ value: 'attempt-3' }),
      baseRevision: 1,
      contentHash: 'hash-v2',
      nowMs: AUTO_SEED_NOW + 1,
    });
    expect((await db.transaction({ statements: [version] })).status).toBe('committed');
    await expect(db.transaction({ statements: [version] })).rejects.toThrow();
    expect(await listAutoArtifactVersions({ db, artifactId: planId })).toEqual([
      expect.objectContaining({ revision: 2, attemptId: 'attempt-3', baseRevision: 1 }),
    ]);
  });

  it('returns the artifact to needs_approval when its revise finishes, only for that revise', async () => {
    const db = await world();
    await db.execute(
      "UPDATE auto_artifacts SET approval_state = 'revising', open_revise_delegation_id = 'delegation-9' WHERE artifact_id = ?",
      [planId],
    );
    const other = finishAutoArtifactReviseStatement({
      artifactId: planId,
      delegationId: brandId<AutoDelegationId>({ value: 'delegation-8' }),
      abortCode: 'finish',
    });
    expect((await db.transaction({ statements: [other] })).status).toBe('aborted');
    const own = finishAutoArtifactReviseStatement({
      artifactId: planId,
      delegationId: brandId<AutoDelegationId>({ value: 'delegation-9' }),
      abortCode: 'finish',
    });
    expect((await db.transaction({ statements: [own] })).status).toBe('committed');
    expect(await getAutoArtifact({ db, artifactId: planId })).toMatchObject({
      approvalState: 'needs_approval',
      openReviseDelegationId: null,
    });
  });
});
