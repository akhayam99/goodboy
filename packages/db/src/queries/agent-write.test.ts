import { beforeEach, describe, expect, it } from 'vitest';
import type {
  AgentId,
  IsoDateTime,
  ProviderId,
  ProviderRunId,
  SessionId,
  StepId,
  WorkflowRoutingDecision,
  WorkflowRoutingLock,
  WorkflowRunId,
  WorkflowTaskProfile,
  WorkspaceId,
} from '@goodboy/types';
import type { Database } from '../client';
import { InvalidWorkflowNodeError, NodeNotMutableError, NotFoundError } from '../shared/errors';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { getAgentById } from './agent';
import {
  insertAgent,
  insertAgentBatch,
  markAgentViewed,
  recordAgentStatus,
  setAgentDone,
  setAgentProviderSession,
  setAgentVerbosity,
  updateWorkflowNodeRouting,
  type AgentInsertInput,
} from './agent-write';

const workspaceId = 'workspace-harborline' as WorkspaceId;
const sessionId = 'session-1' as SessionId;
const containerId = 'container' as AgentId;
const stepId = 'step-1' as StepId;
const PROVIDER = 'codex' as ProviderId;
const STOPPED_AT = '2026-09-25T12:04:00.000Z' as IsoDateTime;

const pick = { provider: PROVIDER, model: 'gpt-5.6', effort: 'high' } as const;

const decision: WorkflowRoutingDecision = {
  version: 1,
  proposal: null,
  selected: pick,
  source: 'agent',
  reason: 'Chosen',
  adjustment: 'none',
  executed: null,
};

const lock: WorkflowRoutingLock = { version: 1, pick, origin: 'user' };

const profile: WorkflowTaskProfile = {
  taskType: 'implementation',
  difficulty: 'heavy',
  basis: 'agent',
};

const malformed = (json: string) => JSON.parse(json);

const child = (id: string, ordinal: number): AgentInsertInput => ({
  id: id as AgentId,
  sessionId,
  ordinal,
  name: `cluster ${ordinal}`,
  status: 'pending',
  kind: 'implementer',
  effort: 'high',
  modelOverride: 'gpt-5.6',
  providerOverride: PROVIDER,
  routingDecision: decision,
  taskProfile: profile,
});

describe('agent writes', () => {
  let db: Database;

  beforeEach(async () => {
    db = await makeMigratedTestDatabase();
    const now = Date.now();
    await db.execute(
      'INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [workspaceId, 'Harborline', 'harborline', now, now],
    );
    await db.execute(
      'INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [sessionId, workspaceId, 'goal', 'idle', now, now],
    );
    await db.execute(
      "INSERT INTO workflows (id, workspace_id, name, created_at, updated_at) VALUES ('wf-1', ?, 'Close the books', 1, 1)",
      [workspaceId],
    );
    await db.execute(
      "INSERT INTO steps (id, workflow_id, ordinal, name) VALUES (?, 'wf-1', 0, 'Reconcile')",
      [stepId],
    );
  });

  const childIds = async (parent: AgentId): Promise<ReadonlyArray<string>> =>
    (
      await db.select<{ id: string }>(
        'SELECT id FROM agents WHERE parent_agent_id = ? ORDER BY ordinal',
        [parent],
      )
    ).map((row) => row.id);

  const seedAgent = async (id: string, status: string): Promise<AgentId> => {
    await db.execute(
      "INSERT INTO agents (id, session_id, step_id, ordinal, name, status) VALUES (?, ?, ?, 0, 'implementer', ?)",
      [id, sessionId, stepId, status],
    );
    return id as AgentId;
  };

  describe('insertAgent', () => {
    it('writes every column the caller gave and returns the stored agent', async () => {
      await db.execute(
        "INSERT INTO session_workflows (session_id, workflow_id, workflow_run_id, ordinal, created_at) VALUES (?, 'wf-1', 'run-1', 0, 1)",
        [sessionId],
      );
      const agent = await insertAgent(db, {
        ...child('a1', 3),
        stepId,
        workflowRunId: 'run-1' as WorkflowRunId,
        startedAt: STOPPED_AT,
        completedAt: STOPPED_AT,
        outputSummary: 'done',
        verbosity: 'brief',
        sourceThreadId: 'thread-1',
        sourceThreadIds: ['thread-1', 'thread-2'],
        sourceCommentUrl: 'https://example.test/c/1',
        sourceKind: 'review_comment',
        domains: ['ledger-core'],
        routingLock: lock,
      });

      expect(agent).toMatchObject({
        id: 'a1',
        sessionId,
        stepId,
        ordinal: 3,
        name: 'cluster 3',
        status: 'pending',
        kind: 'implementer',
        effort: 'high',
        modelOverride: 'gpt-5.6',
        providerOverride: 'codex',
        workflowRunId: 'run-1',
        outputSummary: 'done',
        verbosity: 'brief',
        startedAt: STOPPED_AT,
        completedAt: STOPPED_AT,
        sourceThreadId: 'thread-1',
        sourceThreadIds: ['thread-1', 'thread-2'],
        sourceCommentUrl: 'https://example.test/c/1',
        sourceKind: 'review_comment',
        domains: ['ledger-core'],
        routingLock: lock,
        routingDecision: decision,
        taskProfile: profile,
      });
    });

    it('generates an id when the caller gives none', async () => {
      const withoutId: AgentInsertInput = { ...child('a1', 0), id: undefined };

      const agent = await insertAgent(db, withoutId);

      expect(agent.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(await getAgentById(db, agent.id)).not.toBeNull();
    });

    it('rejects an invalid routing value and writes nothing', async () => {
      const broken = { ...child('a1', 0), taskProfile: malformed('{"taskType":"nonsense"}') };

      await expect(insertAgent(db, broken)).rejects.toThrow('Invalid task profile');

      expect(await getAgentById(db, 'a1' as AgentId)).toBeNull();
    });
  });

  describe('insertAgentBatch', () => {
    it('commits every child at once under the parent', async () => {
      const outcome = await insertAgentBatch(db, {
        parentAgentId: containerId,
        children: [child('c1', 0), child('c2', 1), child('c3', 2)],
      });

      expect(outcome.inserted).toBe(true);
      expect(outcome.agents.map((agent) => agent.id)).toEqual(['c1', 'c2', 'c3']);
      expect(await childIds(containerId)).toEqual(['c1', 'c2', 'c3']);
      expect(outcome.agents[0]).toMatchObject({
        parentAgentId: containerId,
        providerOverride: 'codex',
        modelOverride: 'gpt-5.6',
        effort: 'high',
        routingDecision: decision,
        taskProfile: profile,
      });
    });

    it('leaves no children when one insert fails', async () => {
      await db.execute(
        "INSERT INTO agents (id, session_id, ordinal, name, status) VALUES ('c2', ?, 9, 'taken', 'pending')",
        [sessionId],
      );

      await expect(
        insertAgentBatch(db, {
          parentAgentId: containerId,
          children: [child('c1', 0), child('c2', 1), child('c3', 2)],
        }),
      ).rejects.toThrow();

      expect(await childIds(containerId)).toEqual([]);
      const strays = await db.select<{ id: string }>(
        "SELECT id FROM agents WHERE id IN ('c1', 'c3')",
      );
      expect(strays).toEqual([]);
    });

    it('rejects an invalid routing value before writing anything', async () => {
      const broken = { ...child('c2', 1), taskProfile: malformed('{"taskType":"nonsense"}') };

      await expect(
        insertAgentBatch(db, { parentAgentId: containerId, children: [child('c1', 0), broken] }),
      ).rejects.toThrow('Invalid task profile');

      expect(await childIds(containerId)).toEqual([]);
    });

    it('does not give a parent a second batch', async () => {
      await insertAgentBatch(db, {
        parentAgentId: containerId,
        children: [child('c1', 0), child('c2', 1)],
      });

      const outcome = await insertAgentBatch(db, {
        parentAgentId: containerId,
        children: [child('c3', 2), child('c4', 3)],
      });

      expect(outcome.inserted).toBe(false);
      expect(outcome.agents.map((agent) => agent.id)).toEqual(['c1', 'c2']);
      expect(await childIds(containerId)).toEqual(['c1', 'c2']);
    });

    it('gives the batch up when another writer fanned out between the look and the write', async () => {
      await insertAgentBatch(db, { parentAgentId: containerId, children: [child('c1', 0)] });
      let firstLook = true;
      const staleLook: Database = {
        ...db,
        select: async <T>(sql: string, params?: ReadonlyArray<unknown>) => {
          if (firstLook && sql.includes('FROM live_agents WHERE parent_agent_id')) {
            firstLook = false;
            return [];
          }
          return db.select<T>(sql, params);
        },
      };

      const outcome = await insertAgentBatch(staleLook, {
        parentAgentId: containerId,
        children: [child('c2', 1), child('c3', 2)],
      });

      expect(outcome.inserted).toBe(false);
      expect(outcome.agents.map((agent) => agent.id)).toEqual(['c1']);
      expect(await childIds(containerId)).toEqual(['c1']);
    });

    it('answers an empty batch with the children already there', async () => {
      const outcome = await insertAgentBatch(db, { parentAgentId: containerId, children: [] });

      expect(outcome).toEqual({ inserted: false, agents: [] });
    });

    it('fans out again once every child is tombstoned', async () => {
      await insertAgentBatch(db, {
        parentAgentId: containerId,
        children: [child('c1', 0), child('c2', 1)],
      });
      await db.execute('UPDATE agents SET deleted_at = 1 WHERE parent_agent_id = ?', [containerId]);

      const outcome = await insertAgentBatch(db, {
        parentAgentId: containerId,
        children: [child('c3', 2)],
      });

      expect(outcome.inserted).toBe(true);
      expect(outcome.agents.map((agent) => agent.id)).toEqual(['c3']);
    });

    it('skips a tombstoned child among live ones', async () => {
      await insertAgentBatch(db, {
        parentAgentId: containerId,
        children: [child('c1', 0), child('c2', 1)],
      });
      await db.execute("UPDATE agents SET deleted_at = 1 WHERE id = 'c1'");

      const outcome = await insertAgentBatch(db, {
        parentAgentId: containerId,
        children: [child('c3', 2)],
      });

      expect(outcome.inserted).toBe(false);
      expect(outcome.agents.map((agent) => agent.id)).toEqual(['c2']);
    });
  });

  describe('recordAgentStatus', () => {
    it('stamps and clears the stop', async () => {
      const id = await seedAgent('a3', 'running');

      const stopped = await recordAgentStatus(db, id, {
        status: 'stopped',
        stoppedAt: STOPPED_AT,
        stoppedBy: 'you',
      });
      expect(stopped.status).toBe('stopped');
      expect(stopped.stoppedAt).toBe(STOPPED_AT);
      expect(stopped.stoppedBy).toBe('you');
      expect(stopped.lastFinishedAt).toBeUndefined();

      const resumed = await recordAgentStatus(db, id, { status: 'running' });
      expect(resumed.status).toBe('running');
      expect(resumed.stoppedAt).toBeUndefined();
      expect(resumed.stoppedBy).toBeUndefined();
    });

    it('records who stopped the agent as you when the caller says nothing', async () => {
      const id = await seedAgent('a3', 'running');

      const stopped = await recordAgentStatus(db, id, { status: 'stopped' });

      expect(stopped.stoppedBy).toBe('you');
      expect(stopped.stoppedAt).toBeDefined();
    });

    it('stamps last_finished_at on a terminal status and only then', async () => {
      const id = await seedAgent('a3', 'pending');

      const running = await recordAgentStatus(db, id, {
        status: 'running',
        startedAt: STOPPED_AT,
        providerRunId: 'run-9' as ProviderRunId,
      });
      expect(running.lastFinishedAt).toBeUndefined();
      expect(running.startedAt).toBe(STOPPED_AT);
      expect(running.runId).toBe('run-9');

      const done = await recordAgentStatus(db, id, {
        status: 'completed',
        completedAt: '2026-09-25T12:10:00.000Z' as IsoDateTime,
        outputSummary: 'reconciled',
      });
      expect(done.lastFinishedAt).toBe('2026-09-25T12:10:00.000Z');
      expect(done.completedAt).toBe('2026-09-25T12:10:00.000Z');
      expect(done.outputSummary).toBe('reconciled');
      expect(done.runId).toBe('run-9');
    });

    it('keeps the first finish time when a terminal status is written again without one', async () => {
      const id = await seedAgent('a3', 'running');
      await recordAgentStatus(db, id, {
        status: 'failed',
        completedAt: '2026-09-25T12:10:00.000Z' as IsoDateTime,
      });

      const again = await recordAgentStatus(db, id, { status: 'blocked' });

      expect(again.lastFinishedAt).toBe('2026-09-25T12:10:00.000Z');
    });

    it('refuses an agent that does not exist', async () => {
      await expect(
        recordAgentStatus(db, 'missing' as AgentId, { status: 'running' }),
      ).rejects.toThrow(new NotFoundError('agent', 'missing'));
    });
  });

  describe('single-column writes', () => {
    it('sets and clears the verbosity', async () => {
      const id = await seedAgent('a1', 'pending');

      await setAgentVerbosity(db, id, 'verbose');
      expect((await getAgentById(db, id))?.verbosity).toBe('verbose');

      await setAgentVerbosity(db, id, null);
      expect((await getAgentById(db, id))?.verbosity).toBeUndefined();
    });

    it('stores the provider session and its owner', async () => {
      const id = await seedAgent('a1', 'pending');

      await setAgentProviderSession(db, {
        id,
        providerSessionId: 'session-abc',
        providerSessionProviderId: 'anthropic' as ProviderId,
      });

      expect(await getAgentById(db, id)).toMatchObject({
        providerSessionId: 'session-abc',
        providerSessionProviderId: 'anthropic',
      });
    });

    it('stamps the viewed time, and falls back to now for an unreadable one', async () => {
      const id = await seedAgent('a1', 'pending');

      await markAgentViewed(db, id, STOPPED_AT);
      expect((await getAgentById(db, id))?.lastViewedAt).toBe(STOPPED_AT);

      await markAgentViewed(db, id, 'not a date' as IsoDateTime);
      const stamped = (await getAgentById(db, id))?.lastViewedAt;
      expect(stamped).toBeDefined();
      expect(stamped).not.toBe(STOPPED_AT);
    });

    it('marks an agent done and reopens it', async () => {
      const id = await seedAgent('a1', 'completed');

      await setAgentDone(db, id, true, STOPPED_AT);
      expect((await getAgentById(db, id))?.doneAt).toBe(STOPPED_AT);

      await setAgentDone(db, id, false, STOPPED_AT);
      expect((await getAgentById(db, id))?.doneAt).toBeUndefined();
    });

    it.each([
      ['setAgentVerbosity', (id: AgentId) => setAgentVerbosity(db, id, 'brief')],
      [
        'setAgentProviderSession',
        (id: AgentId) =>
          setAgentProviderSession(db, {
            id,
            providerSessionId: 's',
            providerSessionProviderId: 'anthropic' as ProviderId,
          }),
      ],
      ['markAgentViewed', (id: AgentId) => markAgentViewed(db, id, STOPPED_AT)],
      ['setAgentDone', (id: AgentId) => setAgentDone(db, id, true, STOPPED_AT)],
    ])('%s refuses an agent that does not exist', async (_name, write) => {
      await expect(write('missing' as AgentId)).rejects.toThrow(
        new NotFoundError('agent', 'missing'),
      );
    });
  });

  describe('updateWorkflowNodeRouting', () => {
    const routing = {
      routingLock: lock,
      routingDecision: decision,
      taskProfile: profile,
      providerOverride: PROVIDER,
      modelOverride: 'gpt-5.6',
      effort: 'high' as const,
    };

    it('writes the routing of a pending agent', async () => {
      const id = await seedAgent('a1', 'pending');

      await updateWorkflowNodeRouting(db, { nodeKind: 'agent', id, ...routing });

      expect(await getAgentById(db, id)).toMatchObject({
        routingLock: lock,
        routingDecision: decision,
        taskProfile: profile,
        providerOverride: 'codex',
        modelOverride: 'gpt-5.6',
        effort: 'high',
      });
    });

    it.each(['starting', 'running', 'completed'])(
      'refuses to change an agent that is %s',
      async (status) => {
        const id = await seedAgent('a1', status);

        await expect(
          updateWorkflowNodeRouting(db, { nodeKind: 'agent', id, ...routing }),
        ).rejects.toThrow(new NodeNotMutableError(id));

        expect((await getAgentById(db, id))?.routingDecision).toBeNull();
      },
    );

    it('refuses an agent that does not exist', async () => {
      await expect(
        updateWorkflowNodeRouting(db, { nodeKind: 'agent', id: 'missing' as AgentId, ...routing }),
      ).rejects.toThrow(new NotFoundError('agent', 'missing'));
    });

    it('writes the routing of a step nobody has started', async () => {
      await updateWorkflowNodeRouting(db, { nodeKind: 'step', id: stepId, ...routing });

      const [row] = await db.select<{ routing_decision: string; provider_override: string }>(
        'SELECT routing_decision, provider_override FROM steps WHERE id = ?',
        [stepId],
      );
      expect(JSON.parse(row?.routing_decision ?? 'null')).toEqual(decision);
      expect(row?.provider_override).toBe('codex');
    });

    it('refuses a step once a live agent of it has started', async () => {
      await seedAgent('a1', 'running');

      await expect(
        updateWorkflowNodeRouting(db, { nodeKind: 'step', id: stepId, ...routing }),
      ).rejects.toThrow(new NodeNotMutableError(stepId));
    });

    it('lets a step change when the only started agent of it is tombstoned', async () => {
      await seedAgent('a1', 'running');
      await db.execute('UPDATE agents SET deleted_at = 1');

      await updateWorkflowNodeRouting(db, { nodeKind: 'step', id: stepId, ...routing });

      const [row] = await db.select<{ provider_override: string }>(
        'SELECT provider_override FROM steps WHERE id = ?',
        [stepId],
      );
      expect(row?.provider_override).toBe('codex');
    });

    it('refuses a step that does not exist', async () => {
      await expect(
        updateWorkflowNodeRouting(db, { nodeKind: 'step', id: 'missing' as StepId, ...routing }),
      ).rejects.toThrow(new NotFoundError('workflow', 'missing'));
    });

    it('refuses an unknown node kind', async () => {
      await expect(
        updateWorkflowNodeRouting(db, {
          nodeKind: malformed('"phase"'),
          id: stepId,
          ...routing,
        }),
      ).rejects.toThrow(new InvalidWorkflowNodeError('phase'));
    });

    it('rejects an invalid routing value and writes nothing', async () => {
      const id = await seedAgent('a1', 'pending');

      await expect(
        updateWorkflowNodeRouting(db, {
          nodeKind: 'agent',
          id,
          ...routing,
          routingLock: malformed(
            '{"version":1,"pick":{"provider":"nowhere","model":"gpt-5.6","effort":"high"},"origin":"user"}',
          ),
        }),
      ).rejects.toThrow('Invalid routing lock');

      expect((await getAgentById(db, id))?.providerOverride).toBeUndefined();
    });
  });
});
