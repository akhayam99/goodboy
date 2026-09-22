import { describe, expect, it } from 'vitest';
import type { AgentId, SessionId, WorkflowRunId } from '@goodboy/types';
import { migrate } from '../migrations/runner';
import { makeTestDatabase } from '../test-helpers/test-db';
import {
  listClusterCompletionHolds,
  recordClusterCompletionHold,
  resolveClusterCompletionHold,
} from './cluster-completion-hold';

const sessionId = 'session' as SessionId;
const workflowRunId = 'run' as WorkflowRunId;
const containerAgentId = 'container' as AgentId;
const sourceAgentId = 'source' as AgentId;

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
    "INSERT INTO agents (id, session_id, ordinal, name, status, workflow_run_id, parent_agent_id) VALUES ('source', 'session', 1, 'Cluster', 'failed', 'run', 'container')",
  );
  return db;
};

describe('cluster completion hold queries', () => {
  it('records duplicate delivery once and resolves with evidence', async () => {
    const db = await seed();
    const hold = {
      id: 'hold-1',
      sessionId,
      workflowRunId,
      containerAgentId,
      sourceAgentId,
      sourceTurnId: 'turn-1',
      reason: 'unresolved-outcome' as const,
      findings: [{ reason: 'network proof is missing', target: 'tester' as const }],
    };

    await recordClusterCompletionHold({ db, hold });
    await recordClusterCompletionHold({ db, hold: { ...hold, id: 'hold-2' } });
    expect(await listClusterCompletionHolds({ db, sessionId })).toHaveLength(1);

    await resolveClusterCompletionHold({
      db,
      id: 'hold-1',
      resolutionEvidence: 'verified by the user',
    });
    const [resolved] = await listClusterCompletionHolds({ db, sessionId });
    expect(resolved?.state).toBe('resolved');
    expect(resolved?.resolutionEvidence).toBe('verified by the user');
  });
});
