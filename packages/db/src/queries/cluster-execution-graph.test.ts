import { describe, expect, it } from 'vitest';
import type { AgentId, ClusterGraph, SessionId, WorkflowRunId } from '@goodboy/types';
import { migrate } from '../migrations/runner';
import { makeTestDatabase } from '../test-helpers/test-db';
import {
  getClusterExecutionGraph,
  listClusterExecutionGraphs,
  recordClusterExecutionGraph,
} from './cluster-execution-graph';

const sessionId = 'session' as SessionId;
const workflowRunId = 'run' as WorkflowRunId;
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
    "INSERT INTO agents (id, session_id, ordinal, name, status, workflow_run_id, parent_agent_id) VALUES ('impl', 'session', 1, 'Rewrite', 'pending', 'run', 'container')",
  );
  await db.execute(
    "INSERT INTO agents (id, session_id, ordinal, name, status, workflow_run_id, parent_agent_id) VALUES ('review', 'session', 2, 'Review', 'pending', 'run', 'container')",
  );
  return db;
};

const graph: ClusterGraph = {
  executionVersion: 2,
  nodes: [
    {
      id: 'impl',
      ordinal: 0,
      title: 'Rewrite',
      instructions: 'do it',
      role: 'implementer',
      dependsOn: [],
      expectedOutput: null,
    },
    {
      id: 'review',
      ordinal: 1,
      title: 'Review',
      instructions: 'audit it',
      role: 'reviewer',
      dependsOn: ['impl'],
      expectedOutput: 'a findings list',
    },
  ],
};

const snapshot = {
  containerAgentId,
  sessionId,
  workflowRunId,
  planId: 'plan-1',
  goalTitle: 'Routing rewrite',
  graph,
  nodes: [
    { nodeId: 'impl', agentId: 'impl' as AgentId, ordinal: 0, role: 'implementer' as const },
    { nodeId: 'review', agentId: 'review' as AgentId, ordinal: 1, role: 'reviewer' as const },
  ],
};

describe('cluster execution graph queries', () => {
  it('stores the consumed graph with its node execution records', async () => {
    const db = await seed();

    const stored = await recordClusterExecutionGraph({ db, snapshot });

    expect(stored.graph).toEqual(graph);
    expect(stored.goalTitle).toBe('Routing rewrite');
    expect(stored.nodes.map((node) => node.role)).toEqual(['implementer', 'reviewer']);
    expect(await listClusterExecutionGraphs({ db, sessionId })).toEqual([stored]);
  });

  it('keeps the first snapshot when the same container is recorded again', async () => {
    const db = await seed();
    await recordClusterExecutionGraph({ db, snapshot });

    const second = await recordClusterExecutionGraph({
      db,
      snapshot: {
        ...snapshot,
        goalTitle: 'Edited goal',
        graph: {
          executionVersion: 2,
          nodes: [{ ...graph.nodes[0]!, instructions: 'edited instructions' }],
        },
      },
    });

    expect(second.goalTitle).toBe('Routing rewrite');
    expect(second.graph).toEqual(graph);
    expect(await getClusterExecutionGraph({ db, containerAgentId })).toEqual(second);
  });
});
