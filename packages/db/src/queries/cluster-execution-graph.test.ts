import { describe, expect, it } from 'vitest';
import type { AgentId, ClusterGraph, SessionId, WorkflowRunId } from '@goodboy/types';
import { migrate } from '../migrations/runner';
import { makeTestDatabase } from '../test-helpers/test-db';
import {
  adoptClusterGraphRevision,
  freezeClusterExecutionGraph,
  getClusterExecutionGraph,
  listClusterExecutionGraphs,
  listClusterGraphRevisions,
  recordClusterExecutionGraph,
  refuseClusterGraphRevision,
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

  it('adds no node binding when the same container is recorded again with a new node', async () => {
    const db = await seed();
    await recordClusterExecutionGraph({ db, snapshot });

    const second = await recordClusterExecutionGraph({
      db,
      snapshot: {
        ...snapshot,
        nodes: [
          ...snapshot.nodes,
          { nodeId: 'extra', agentId: 'review' as AgentId, ordinal: 2, role: 'tester' as const },
        ],
      },
    });

    expect(second.graph).toEqual(graph);
    expect(second.nodes.map((node) => node.nodeId)).toEqual(['impl', 'review']);
  });
});

describe('cluster graph revisions', () => {
  it('freezes the execution once and keeps the first reason', async () => {
    const db = await seed();
    await recordClusterExecutionGraph({ db, snapshot });
    await freezeClusterExecutionGraph({
      db,
      containerAgentId,
      reason: 'the review found a structural defect',
      obligationId: 'obl-1',
    });
    const frozen = await freezeClusterExecutionGraph({
      db,
      containerAgentId,
      reason: 'a second escalation',
      obligationId: 'obl-2',
    });
    expect(frozen?.frozenReason).toBe('the review found a structural defect');
    expect(frozen?.frozenObligationId).toBe('obl-1');
  });

  it('adopts a revision, supersedes the replaced node and unfreezes', async () => {
    const db = await seed();
    await recordClusterExecutionGraph({ db, snapshot });
    await freezeClusterExecutionGraph({
      db,
      containerAgentId,
      reason: 'structural defect',
      obligationId: 'obl-1',
    });
    const outcome = await adoptClusterGraphRevision({
      db,
      revision: {
        id: 'rev-1',
        containerAgentId,
        obligationId: 'obl-1',
        fromRevision: 1,
        toRevision: 2,
        reason: 'the planner split the rewrite',
        graph: {
          executionVersion: 2,
          nodes: [
            {
              id: 'impl-2',
              ordinal: 0,
              title: 'Rewrite in two passes',
              instructions: 'do it differently',
              role: 'implementer',
              dependsOn: [],
              expectedOutput: null,
            },
          ],
        },
        nodes: [
          {
            nodeId: 'impl-2',
            agentId: null,
            ordinal: 0,
            role: 'implementer',
            state: 'active',
            supersededBy: null,
            revision: 2,
            resultState: 'pending',
          },
          {
            nodeId: 'impl',
            agentId: 'impl' as AgentId,
            ordinal: 0,
            role: 'implementer',
            state: 'superseded',
            supersededBy: 'impl-2',
            revision: 2,
            resultState: 'quarantined',
          },
        ],
      },
    });
    expect(outcome.kind).toBe('adopted');
    const stored = await getClusterExecutionGraph({ db, containerAgentId });
    expect(stored?.revision).toBe(2);
    expect(stored?.frozenReason).toBeNull();
    const superseded = stored?.nodes.find((node) => node.nodeId === 'impl');
    expect(superseded).toEqual({
      nodeId: 'impl',
      agentId: 'impl',
      ordinal: 0,
      role: 'implementer',
      state: 'superseded',
      supersededBy: 'impl-2',
      revision: 2,
      resultState: 'quarantined',
    });
    const journal = await listClusterGraphRevisions({ db, containerAgentId });
    expect(journal).toHaveLength(1);
    expect(journal[0]?.state).toBe('adopted');
  });

  it('keeps the graph at its revision when a node write fails during adoption', async () => {
    const db = await seed();
    await recordClusterExecutionGraph({ db, snapshot });
    await expect(
      adoptClusterGraphRevision({
        db,
        revision: {
          id: 'rev-1',
          containerAgentId,
          obligationId: null,
          fromRevision: 1,
          toRevision: 2,
          reason: 'broken',
          graph,
          nodes: [
            {
              nodeId: 'impl-2',
              agentId: null,
              ordinal: 0,
              role: 'not-a-role' as 'implementer',
              state: 'active',
              supersededBy: null,
              revision: 2,
              resultState: 'pending',
            },
          ],
        },
      }),
    ).rejects.toThrow();
    const stored = await getClusterExecutionGraph({ db, containerAgentId });
    expect(stored?.revision).toBe(1);
    expect(await listClusterGraphRevisions({ db, containerAgentId })).toHaveLength(0);
  });

  it('refuses a revision formed against an older graph and leaves the graph alone', async () => {
    const db = await seed();
    await recordClusterExecutionGraph({ db, snapshot });
    await adoptClusterGraphRevision({
      db,
      revision: {
        id: 'rev-1',
        containerAgentId,
        obligationId: null,
        fromRevision: 1,
        toRevision: 2,
        reason: 'first',
        graph,
        nodes: [],
      },
    });
    const stale = await adoptClusterGraphRevision({
      db,
      revision: {
        id: 'rev-2',
        containerAgentId,
        obligationId: null,
        fromRevision: 1,
        toRevision: 2,
        reason: 'stale',
        graph: { executionVersion: 2, nodes: [] },
        nodes: [],
      },
    });
    expect(stale.kind).toBe('stale');
    const stored = await getClusterExecutionGraph({ db, containerAgentId });
    expect(stored?.revision).toBe(2);
    expect(stored?.graph.nodes).toHaveLength(2);
  });

  it('journals a refusal without touching the graph', async () => {
    const db = await seed();
    await recordClusterExecutionGraph({ db, snapshot });
    await freezeClusterExecutionGraph({
      db,
      containerAgentId,
      reason: 'structural defect',
      obligationId: 'obl-1',
    });
    await refuseClusterGraphRevision({
      db,
      id: 'rev-refused',
      containerAgentId,
      obligationId: 'obl-1',
      fromRevision: 1,
      reason: 'the proposal replaces a cluster that already completed',
    });
    const stored = await getClusterExecutionGraph({ db, containerAgentId });
    expect(stored?.revision).toBe(1);
    expect(stored?.frozenReason).toBe('structural defect');
    const journal = await listClusterGraphRevisions({ db, containerAgentId });
    expect(journal[0]?.state).toBe('refused');
    expect(journal[0]?.reason).toBe('the proposal replaces a cluster that already completed');
  });
});
