import { describe, expect, it } from 'vitest';
import type { AgentId, ClusterGraph, MountId, SessionId } from '@goodboy/types';
import { migrate } from '../migrations/runner';
import { makeTestDatabase } from '../test-helpers/test-db';
import {
  bindClusterAttemptLease,
  bindClusterAttemptMount,
  claimClusterAttempt,
  getClusterAttempt,
  listClusterAttemptsForSessions,
  listClusterExecutionEligibilityForSessions,
  recordClusterAttemptPreparation,
  recordClusterExecutionEligibility,
  settleClusterAttempt,
  type ClusterAttemptClaim,
} from './cluster-attempt';
import { getClusterExecutionGraph, recordClusterExecutionGraph } from './cluster-execution-graph';

const sessionId = 'session' as SessionId;
const containerAgentId = 'container' as AgentId;

const graph: ClusterGraph = {
  executionVersion: 2,
  nodes: [
    {
      id: 'impl-a',
      ordinal: 0,
      title: 'Rewrite',
      instructions: 'do it',
      role: 'implementer',
      dependsOn: [],
      expectedOutput: null,
      writeScope: { version: 1, files: ['src/a.ts'], directories: ['src/routing'] },
    },
  ],
};

const seed = async () => {
  const db = makeTestDatabase();
  await migrate(db);
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Workspace', 'workspace', 1, 1)",
  );
  await db.execute(
    "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('session', 'workspace', 'Goal', 'idle', 1, 1)",
  );
  await db.execute(
    "INSERT INTO agents (id, session_id, ordinal, name, status) VALUES ('container', 'session', 0, 'Container', 'running')",
  );
  await recordClusterExecutionGraph({
    db,
    snapshot: {
      containerAgentId,
      sessionId,
      workflowRunId: null,
      planId: null,
      goalTitle: 'Goal',
      graph,
      nodes: [{ nodeId: 'impl-a', agentId: null, ordinal: 0, role: 'implementer' }],
    },
  });
  return db;
};

const claim = (overrides: Partial<ClusterAttemptClaim> = {}): ClusterAttemptClaim => ({
  id: 'attempt-1',
  requestId: 'request-1',
  containerAgentId,
  sessionId,
  nodeId: 'impl-a',
  graphRevision: 1,
  scopeRevision: 1,
  writeScope: { version: 1, files: ['src/a.ts'], directories: ['src/routing'] },
  baseSha: 'a'.repeat(40),
  setupRevision: 3,
  setupCommand: 'CI=1 pnpm install --frozen-lockfile --ignore-scripts',
  ...overrides,
});

const target = {
  mountId: 'mount-1' as MountId,
  mountRevision: 0,
  worktreePath: '/repo/.goodboy/worktrees/attempt-1',
  branch: 'ak/attempt-1',
  repoRoot: '/repo',
};

describe('cluster attempt queries', () => {
  it('keeps a declared write scope through the persisted graph', async () => {
    const db = await seed();
    const stored = await getClusterExecutionGraph({ db, containerAgentId });

    expect(stored?.graph.nodes[0]?.writeScope).toEqual({
      version: 1,
      files: ['src/a.ts'],
      directories: ['src/routing'],
    });
  });

  it('returns the same attempt for a duplicate claim of one request id', async () => {
    const db = await seed();

    const first = await claimClusterAttempt({ db, claim: claim() });
    const again = await claimClusterAttempt({
      db,
      claim: claim({ id: 'attempt-other', baseSha: 'b'.repeat(40) }),
    });

    expect(first).toMatchObject({ kind: 'claimed', isNew: true });
    expect(again.kind).toBe('claimed');
    expect(again.attempt.id).toBe('attempt-1');
    expect(again.attempt.baseSha).toBe('a'.repeat(40));
    expect(again.kind === 'claimed' && again.isNew).toBe(false);
    const listed = await listClusterAttemptsForSessions({ db, sessionIds: [sessionId] });
    expect(listed.get(sessionId)).toHaveLength(1);
  });

  it('refuses a second live attempt for the same node under another request', async () => {
    const db = await seed();
    await claimClusterAttempt({ db, claim: claim() });

    const second = await claimClusterAttempt({
      db,
      claim: claim({ id: 'attempt-2', requestId: 'request-2' }),
    });

    expect(second.kind).toBe('busy');
    expect(second.attempt.id).toBe('attempt-1');
  });

  it('numbers a retry after the earlier attempt settled', async () => {
    const db = await seed();
    await claimClusterAttempt({ db, claim: claim() });
    await settleClusterAttempt({ db, id: 'attempt-1', state: 'failed', reason: 'crashed' });

    const retry = await claimClusterAttempt({
      db,
      claim: claim({ id: 'attempt-2', requestId: 'request-2' }),
    });

    expect(retry.kind).toBe('claimed');
    expect(retry.attempt.attemptNumber).toBe(2);
  });

  it('binds a mount once and refuses to retarget it', async () => {
    const db = await seed();
    await claimClusterAttempt({ db, claim: claim() });

    const bound = await bindClusterAttemptMount({ db, id: 'attempt-1', target });
    const rebound = await bindClusterAttemptMount({
      db,
      id: 'attempt-1',
      target: { ...target, mountRevision: 4 },
    });

    expect(bound.state).toBe('allocated');
    expect(rebound.target).toEqual(target);
    await expect(
      bindClusterAttemptMount({
        db,
        id: 'attempt-1',
        target: { ...target, mountId: 'mount-2' as MountId, worktreePath: '/repo/other' },
      }),
    ).rejects.toThrow(/a different target needs a new attempt/);
    expect((await getClusterAttempt({ db, id: 'attempt-1' }))?.target).toEqual(target);
  });

  it('records ownership and a successful preparation baseline', async () => {
    const db = await seed();
    await claimClusterAttempt({ db, claim: claim() });
    await bindClusterAttemptMount({ db, id: 'attempt-1', target });
    await bindClusterAttemptLease({ db, id: 'attempt-1', leaseId: 'lease-1' });

    await expect(
      bindClusterAttemptLease({ db, id: 'attempt-1', leaseId: 'lease-2' }),
    ).rejects.toThrow(/cannot take ownership/);
    const prepared = await recordClusterAttemptPreparation({
      db,
      id: 'attempt-1',
      preparation: {
        result: 'succeeded',
        exitCode: 0,
        output: 'installed',
        baseline: { headSha: 'a'.repeat(40), treeSha: 't'.repeat(40), statusDigest: 'd' },
        reason: null,
      },
    });

    expect(prepared.state).toBe('prepared');
    expect(prepared.leaseId).toBe('lease-1');
    expect(prepared.setup).toEqual({
      revision: 3,
      command: 'CI=1 pnpm install --frozen-lockfile --ignore-scripts',
      result: 'succeeded',
      exitCode: 0,
      output: 'installed',
    });
    expect(prepared.baseline?.treeSha).toBe('t'.repeat(40));
  });

  it('marks a source-changing setup ineligible with its reason', async () => {
    const db = await seed();
    await claimClusterAttempt({ db, claim: claim() });
    await bindClusterAttemptMount({ db, id: 'attempt-1', target });
    await bindClusterAttemptLease({ db, id: 'attempt-1', leaseId: 'lease-1' });

    const refused = await recordClusterAttemptPreparation({
      db,
      id: 'attempt-1',
      preparation: {
        result: 'source-changed',
        exitCode: 0,
        output: '',
        baseline: null,
        reason: 'setup modified pnpm-lock.yaml',
      },
    });

    expect(refused.state).toBe('ineligible');
    expect(refused.reason).toBe('setup modified pnpm-lock.yaml');
    expect(refused.setup.result).toBe('source-changed');
  });

  it('upserts the execution eligibility with its reason', async () => {
    const db = await seed();
    await recordClusterExecutionEligibility({
      db,
      eligibility: {
        containerAgentId,
        sessionId,
        graphRevision: 1,
        state: 'eligible',
        reason: null,
        targetMountId: 'mount-0' as MountId,
        targetHeadSha: 'a'.repeat(40),
      },
    });
    await recordClusterExecutionEligibility({
      db,
      eligibility: {
        containerAgentId,
        sessionId,
        graphRevision: 1,
        state: 'sequential',
        reason: 'the session checkout has uncommitted changes (1 untracked)',
        targetMountId: 'mount-0' as MountId,
        targetHeadSha: null,
      },
    });

    const listed = await listClusterExecutionEligibilityForSessions({
      db,
      sessionIds: [sessionId],
    });
    expect(listed.get(sessionId)).toEqual([
      expect.objectContaining({
        state: 'sequential',
        reason: 'the session checkout has uncommitted changes (1 untracked)',
      }),
    ]);
  });
});
