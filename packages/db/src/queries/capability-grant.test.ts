import { describe, expect, it } from 'vitest';
import type { AgentId, SessionId, WorkflowRunId } from '@goodboy/types';
import { migrate } from '../migrations/runner';
import { makeTestDatabase } from '../test-helpers/test-db';
import {
  claimCapabilityGrant,
  decideCapabilityObligation,
  listCapabilityGrants,
  listCapabilityObligations,
  recordCapabilityNeed,
  settleCapabilityObligation,
  updateCapabilityGrant,
  type CapabilityNeedRecord,
} from './capability-obligation';

const sessionId = 'session' as SessionId;
const workflowRunId = 'run' as WorkflowRunId;
const requesterAgentId = 'source' as AgentId;
const childAgentId = 'child' as AgentId;

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
    "INSERT INTO workflows (id, workspace_id, name, created_at, updated_at) VALUES ('workflow', 'workspace', 'Flow', 1, 1)",
  );
  await db.execute(
    "INSERT INTO session_workflows (workflow_run_id, session_id, workflow_id, ordinal, current_step_ordinal, created_at) VALUES ('run', 'session', 'workflow', 0, 0, 1)",
  );
  await db.execute(
    "INSERT INTO agents (id, session_id, ordinal, name, status, workflow_run_id) VALUES ('source', 'session', 0, 'Review', 'completed', 'run')",
  );
  await db.execute(
    "INSERT INTO agents (id, session_id, ordinal, name, status, workflow_run_id) VALUES ('child', 'session', 1, 'Repair', 'running', 'run')",
  );
  return db;
};

const need = {
  requestId: 'capability-request:source:turn-1',
  obligationId: 'capability-obligation:source:implementer:repair',
  identity: 'source:implementer:repair',
  sessionId,
  workflowRunId,
  requesterAgentId,
  sourceTurnId: 'turn-1',
  targetRole: 'implementer',
  purpose: 'repair',
  question: 'restore the dropped null guard',
  scope: [],
  evidenceRefs: ['review:finding-1'],
  gap: 'the failing path was never executed',
  expectedOutput: 'the guard back with a regression test',
  continuation: 'handoff',
  routingProposal: null,
  inventoryRevision: 'rabc123',
} satisfies CapabilityNeedRecord;

const grantSeed = {
  id: 'capability-grant:capability-obligation:source:implementer:repair',
  obligationId: need.obligationId,
  sessionId,
  workflowRunId,
  grantedRole: 'implementer',
  purpose: 'repair',
  continuation: 'handoff',
  parentOutcome: 'handed-off',
  transferredWork: null,
} as const;

describe('capability grant delivery', () => {
  it('claims one delivery per obligation and reports the second as already delivered', async () => {
    const db = await seed();
    await recordCapabilityNeed({ db, need });

    const first = await claimCapabilityGrant({ db, grant: grantSeed });
    const second = await claimCapabilityGrant({ db, grant: grantSeed });

    expect(first.isFirstDelivery).toBe(true);
    expect(second.isFirstDelivery).toBe(false);
    expect(second.grant.id).toBe(first.grant.id);
    const rows = await db.select<{ readonly count: number }>(
      'SELECT COUNT(*) as count FROM capability_grants WHERE obligation_id = ?',
      [need.obligationId],
    );
    expect(rows[0]?.count).toBe(1);
  });

  it('binds the child and settles the obligation against a verified revision', async () => {
    const db = await seed();
    await recordCapabilityNeed({ db, need });
    await claimCapabilityGrant({ db, grant: grantSeed });
    await decideCapabilityObligation({
      db,
      obligationId: need.obligationId,
      decision: 'granted',
      reason: 'the defect is local, an implementer repairs it',
    });

    const bound = await updateCapabilityGrant({
      db,
      obligationId: need.obligationId,
      state: 'delivered',
      childAgentId,
      replacementAgentId: null,
      verificationAgentId: null,
    });
    expect(bound?.childAgentId).toBe(childAgentId);
    expect(bound?.state).toBe('delivered');

    await settleCapabilityObligation({
      db,
      obligationId: need.obligationId,
      verifiedRevision: 'sha-verified',
      deliveryReceipt: 'repair verified by Focused review',
    });

    const obligations = await listCapabilityObligations({ db, sessionId });
    expect(obligations[0]?.state).toBe('satisfied');
    expect(obligations[0]?.satisfiedRevision).toBe('sha-verified');
    expect(obligations[0]?.deliveryReceipt).toBe('repair verified by Focused review');
    expect(obligations[0]?.deliveredAt).not.toBeNull();
    const settled = await db.select<{ readonly state: string }>(
      'SELECT state FROM capability_grants WHERE obligation_id = ?',
      [need.obligationId],
    );
    expect(settled[0]?.state).toBe('settled');
  });

  it('lists the grants of a session so a reload can rebind a running child', async () => {
    const db = await seed();
    await recordCapabilityNeed({ db, need });
    await claimCapabilityGrant({ db, grant: grantSeed });
    await updateCapabilityGrant({
      db,
      obligationId: need.obligationId,
      state: 'delivered',
      childAgentId,
      replacementAgentId: null,
      verificationAgentId: null,
    });

    const grants = await listCapabilityGrants({ db, sessionId });

    expect(grants).toHaveLength(1);
    expect(grants[0]?.obligationId).toBe(need.obligationId);
    expect(grants[0]?.childAgentId).toBe(childAgentId);
    expect(grants[0]?.state).toBe('delivered');
  });

  it('keeps a refused obligation visible and unowned with its reason', async () => {
    const db = await seed();
    await recordCapabilityNeed({ db, need });
    await decideCapabilityObligation({
      db,
      obligationId: need.obligationId,
      decision: 'refused',
      reason: 'no generation allowance is left in this run',
    });

    const obligations = await listCapabilityObligations({ db, sessionId });
    expect(obligations[0]?.state).toBe('refused');
    expect(obligations[0]?.ownerAgentId).toBeNull();
    expect(obligations[0]?.decisionReason).toBe('no generation allowance is left in this run');
  });

  it('leaves a refinement open so the requester can ask again', async () => {
    const db = await seed();
    await recordCapabilityNeed({ db, need });
    await decideCapabilityObligation({
      db,
      obligationId: need.obligationId,
      decision: 'refinement',
      reason: 'name the failing test before asking for a repair',
    });

    const obligations = await listCapabilityObligations({ db, sessionId });
    expect(obligations[0]?.state).toBe('open');
    expect(obligations[0]?.decision).toBe('refinement');
    expect(obligations[0]?.decisionReason).toBe('name the failing test before asking for a repair');
  });
});
