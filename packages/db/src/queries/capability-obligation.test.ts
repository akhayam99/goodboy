import { describe, expect, it } from 'vitest';
import type { AgentId, SessionId, WorkflowRunId } from '@goodboy/types';
import { migrate } from '../migrations/runner';
import { makeTestDatabase } from '../test-helpers/test-db';
import {
  associateCapabilityObligationHold,
  claimCapabilityObligationOwner,
  listCapabilityObligations,
  recordCapabilityNeed,
  type CapabilityNeedRecord,
} from './capability-obligation';
import { recordClusterCompletionHold } from './cluster-completion-hold';

const sessionId = 'session' as SessionId;
const workflowRunId = 'run' as WorkflowRunId;
const requesterAgentId = 'source' as AgentId;
const containerAgentId = 'container' as AgentId;

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
    "INSERT INTO agents (id, session_id, ordinal, name, status, workflow_run_id) VALUES ('container', 'session', 0, 'Container', 'running', 'run')",
  );
  await db.execute(
    "INSERT INTO agents (id, session_id, ordinal, name, status, workflow_run_id, parent_agent_id) VALUES ('source', 'session', 1, 'Review', 'failed', 'run', 'container')",
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
  question: 'restore the dropped null guard in sendTurn',
  scope: ['apps/desktop/src/store/slices/turn/sendTurn.ts'],
  evidenceRefs: ['review:finding-1'],
  gap: 'the failing path was never executed',
  expectedOutput: 'the guard back with a regression test',
  continuation: 'handoff',
  routingProposal: null,
  inventoryRevision: 'rabc123',
} satisfies CapabilityNeedRecord;

describe('capability obligation queries', () => {
  it('records repeated delivery of one turn as a single request and obligation', async () => {
    const db = await seed();

    await recordCapabilityNeed({ db, need });
    await recordCapabilityNeed({ db, need: { ...need, requestId: 'other-request' } });

    const obligations = await listCapabilityObligations({ db, sessionId });
    expect(obligations).toHaveLength(1);
    expect(obligations[0]?.requests).toHaveLength(1);
    expect(obligations[0]?.requests[0]?.question).toBe(
      'restore the dropped null guard in sendTurn',
    );
    expect(obligations[0]?.state).toBe('open');
  });

  it('converges an unresolved completion hold and a matching need on one obligation', async () => {
    const db = await seed();
    await recordClusterCompletionHold({
      db,
      hold: {
        id: 'hold-1',
        sessionId,
        workflowRunId,
        containerAgentId,
        sourceAgentId: requesterAgentId,
        sourceTurnId: 'turn-1',
        reason: 'unresolved-outcome',
        findings: [{ reason: 'the null guard is gone', target: 'implementer' }],
      },
    });
    await associateCapabilityObligationHold({
      db,
      obligation: {
        id: need.obligationId,
        identity: need.identity,
        sessionId,
        workflowRunId,
        requesterAgentId,
        targetRole: 'implementer',
        purpose: 'repair',
      },
      holdId: 'hold-1',
    });

    await recordCapabilityNeed({ db, need });

    const obligations = await listCapabilityObligations({ db, sessionId });
    expect(obligations).toHaveLength(1);
    expect(obligations[0]?.holdIds).toEqual(['hold-1']);
    expect(obligations[0]?.requests).toHaveLength(1);
  });
});

describe('capability obligation ownership', () => {
  it('gives one owner and one attachment when two requests race for one identity', async () => {
    const db = await seed();
    await db.execute(
      "INSERT INTO agents (id, session_id, ordinal, name, status) VALUES ('owner-a', 'session', 2, 'Owner A', 'pending')",
    );
    await db.execute(
      "INSERT INTO agents (id, session_id, ordinal, name, status) VALUES ('owner-b', 'session', 3, 'Owner B', 'pending')",
    );
    await recordCapabilityNeed({ db, need });

    const [left, right] = await Promise.all([
      claimCapabilityObligationOwner({
        db,
        identity: need.identity,
        ownerAgentId: 'owner-a' as AgentId,
        childAgentId: null,
      }),
      claimCapabilityObligationOwner({
        db,
        identity: need.identity,
        ownerAgentId: 'owner-b' as AgentId,
        childAgentId: null,
      }),
    ]);

    const owned = [left, right].filter((claim) => claim.kind === 'owned');
    const attached = [left, right].filter((claim) => claim.kind === 'attached');
    expect(owned).toHaveLength(1);
    expect(attached).toHaveLength(1);
    expect(attached[0]?.kind === 'attached' ? attached[0].ownerAgentId : null).toBe(
      owned[0]?.kind === 'owned' ? owned[0].ownerAgentId : null,
    );

    const obligations = await listCapabilityObligations({ db, sessionId });
    expect(obligations).toHaveLength(1);
    expect(obligations[0]?.ownerAgentId).toBe(
      owned[0]?.kind === 'owned' ? owned[0].ownerAgentId : null,
    );
  });
});
