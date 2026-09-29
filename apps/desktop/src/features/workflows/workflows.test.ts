// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AgentId,
  IsoDateTime,
  SessionId,
  StepId,
  WorkflowId,
  WorkspaceId,
} from '@goodboy/types';
import { tauriDatabase } from '../../shared/lib/db';
import { CommandError } from '../../shared/lib/invokeCommand';
import { openStorySqlite, rowsOf } from '../../test/sqliteDb';
import {
  invokeAgentInsert,
  invokeAgentInsertBatch,
  invokeAgentList,
  invokeAgentMarkViewed,
  invokeAgentSetDone,
  invokeAgentSetProviderSessionId,
  invokeAgentSetVerbosity,
  invokeAgentUpdateStatus,
  invokeWorkflowDelete,
  invokeWorkflowNodeRoutingUpdate,
  invokeWorkflowUpsert,
} from './workflows';

vi.mock('../../shared/lib/db', async () =>
  (await import('../../test/sqliteDb')).sqliteDbLibModuleMock(),
);

const workspaceId = 'workspace-harborline' as WorkspaceId;
const sessionId = 'session-1' as SessionId;
const STAMP = '2026-09-25T12:04:00.000Z' as IsoDateTime;

const pick = { provider: 'codex', model: 'gpt-5.6', effort: 'high' } as const;

const decision = {
  version: 1,
  proposal: null,
  selected: pick,
  source: 'agent',
  reason: 'Chosen',
  adjustment: 'none',
  executed: null,
} as const;

const malformed = (json: string) => JSON.parse(json);

const rejection = async (attempt: Promise<unknown>): Promise<CommandError> => {
  const error: unknown = await attempt.then(
    () => null,
    (caught: unknown) => caught,
  );
  if (!(error instanceof CommandError)) {
    throw new Error('expected a CommandError');
  }
  return error;
};

describe('workflow writes through the shared database', () => {
  beforeEach(async () => {
    const db = await openStorySqlite();
    const now = Date.now();
    await db.execute(
      'INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [workspaceId, 'Harborline', 'harborline', now, now],
    );
    await db.execute(
      'INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [sessionId, workspaceId, 'goal', 'idle', now, now],
    );
  });

  const insertPending = (id: string, ordinal = 0) =>
    invokeAgentInsert({
      id: id as AgentId,
      sessionId,
      ordinal,
      name: `agent ${ordinal}`,
      status: 'pending',
      providerOverride: 'codex',
    });

  describe('workflows', () => {
    it('saves a workflow with its steps and deletes it again', async () => {
      const saved = await invokeWorkflowUpsert({
        workspaceId,
        name: 'Close the books',
        description: 'Reconcile the ledger',
        steps: [{ ordinal: 0, name: 'Reconcile', promptPrefix: 'reconcile the export' }],
      });

      expect(saved.steps.map((step) => step.name)).toEqual(['Reconcile']);
      expect(await rowsOf({ sql: 'SELECT id FROM steps' })).toHaveLength(1);

      await invokeWorkflowDelete(saved.id);

      expect(await rowsOf({ sql: 'SELECT id FROM workflows' })).toEqual([]);
      expect(await rowsOf({ sql: 'SELECT id FROM steps' })).toEqual([]);
    });

    it('reports a missing workflow as template_not_found', async () => {
      const error = await rejection(invokeWorkflowDelete('missing' as WorkflowId));

      expect(error.kind).toBe('template_not_found');
      expect(error.message).toBe('workflow not found: missing');
    });

    it('refuses an invalid routing value before writing the workflow', async () => {
      await expect(
        invokeWorkflowUpsert({
          workspaceId,
          name: 'Close the books',
          description: 'Reconcile the ledger',
          steps: [
            {
              ordinal: 0,
              name: 'Reconcile',
              promptPrefix: 'x',
              taskProfile: malformed('{"taskType":"nonsense"}'),
            },
          ],
        }),
      ).rejects.toMatchObject({ kind: 'unknown', message: 'Invalid task profile' });

      expect(await rowsOf({ sql: 'SELECT id FROM workflows' })).toEqual([]);
    });
  });

  describe('agents', () => {
    it('reads back the provider session owner of a live agent', async () => {
      await insertPending('agent-1');
      await invokeAgentSetProviderSessionId({
        id: 'agent-1' as AgentId,
        providerSessionId: 'codex-session',
        providerSessionProviderId: 'codex',
      });

      const agents = await invokeAgentList(sessionId);

      expect(agents[0]?.providerSessionId).toBe('codex-session');
      expect(agents[0]?.providerSessionProviderId).toBe('codex');
    });

    it('keeps the source of an agent it inserted', async () => {
      const inserted = await invokeAgentInsert({
        id: 'agent-1' as AgentId,
        sessionId,
        ordinal: 0,
        name: 'answer the thread',
        status: 'pending',
        sourceKind: 'review_comment',
        sourceThreadIds: ['thread-1'],
        sourceCommentUrl: 'https://example.test/c/1',
      });

      const [listed] = await invokeAgentList(sessionId);

      expect(listed).toEqual(inserted);
      expect(listed?.sourceKind).toBe('review_comment');
      expect(listed?.sourceThreadIds).toEqual(['thread-1']);
    });

    it('lists only the live agents of the session in order', async () => {
      await insertPending('agent-2', 1);
      await insertPending('agent-1', 0);
      await insertPending('agent-3', 2);
      await tauriDatabase.execute('UPDATE agents SET deleted_at = 1 WHERE id = ?', ['agent-3']);

      const agents = await invokeAgentList(sessionId);

      expect(agents.map((agent) => agent.id)).toEqual(['agent-1', 'agent-2']);
    });

    it('sequences refreshes for one session so an older snapshot settles first', async () => {
      await insertPending('agent-1');
      const select = tauriDatabase.select.bind(tauriDatabase);
      let releaseFirst: () => void = () => undefined;
      const gate = new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });
      const spy = vi.spyOn(tauriDatabase, 'select');
      spy.mockImplementationOnce(async (sql, params) => {
        const snapshot = await select(sql, params);
        await gate;
        return snapshot;
      });

      const first = invokeAgentList(sessionId);
      await vi.waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
      await tauriDatabase.execute("UPDATE agents SET status = 'completed'");
      const second = invokeAgentList(sessionId);
      releaseFirst();

      await expect(first).resolves.toMatchObject([{ status: 'pending' }]);
      await expect(second).resolves.toMatchObject([{ status: 'completed' }]);
      expect(spy).toHaveBeenCalledTimes(2);
      spy.mockRestore();
    });

    it('walks an agent through its status writes', async () => {
      await insertPending('agent-1');

      const running = await invokeAgentUpdateStatus('agent-1' as AgentId, {
        status: 'running',
        startedAt: STAMP,
      });
      expect(running).toMatchObject({ status: 'running', startedAt: STAMP });

      const stopped = await invokeAgentUpdateStatus('agent-1' as AgentId, {
        status: 'stopped',
        stoppedAt: STAMP,
      });
      expect(stopped).toMatchObject({ status: 'stopped', stoppedAt: STAMP, stoppedBy: 'you' });

      await invokeAgentMarkViewed('agent-1' as AgentId, STAMP);
      await invokeAgentSetDone('agent-1' as AgentId, true, STAMP);
      await invokeAgentSetVerbosity('agent-1' as AgentId, 'brief');
      const [agent] = await invokeAgentList(sessionId);
      expect(agent).toMatchObject({ lastViewedAt: STAMP, doneAt: STAMP, verbosity: 'brief' });
    });

    it('fans out one batch under a parent and refuses a second', async () => {
      const children = [
        { id: 'c1' as AgentId, sessionId, ordinal: 0, name: 'one', status: 'pending' as const },
        { id: 'c2' as AgentId, sessionId, ordinal: 1, name: 'two', status: 'pending' as const },
      ];

      const first = await invokeAgentInsertBatch({ parentAgentId: 'parent' as AgentId, children });
      const second = await invokeAgentInsertBatch({
        parentAgentId: 'parent' as AgentId,
        children: [{ ...children[0]!, id: 'c3' as AgentId }],
      });

      expect(first.inserted).toBe(true);
      expect(second.inserted).toBe(false);
      expect(second.agents.map((agent) => agent.id)).toEqual(['c1', 'c2']);
    });

    it.each([
      ['agent_set_verbosity', () => invokeAgentSetVerbosity('missing' as AgentId, 'brief')],
      ['agent_mark_viewed', () => invokeAgentMarkViewed('missing' as AgentId, STAMP)],
      ['agent_set_done', () => invokeAgentSetDone('missing' as AgentId, true, STAMP)],
      [
        'agent_update_status',
        () => invokeAgentUpdateStatus('missing' as AgentId, { status: 'running' }),
      ],
    ])('reports a missing agent from %s as run_not_found', async (_command, write) => {
      const error = await rejection(write());

      expect(error.kind).toBe('run_not_found');
      expect(error.message).toBe('agent not found: missing');
    });

    it('refuses to re-route a started agent as node_not_mutable', async () => {
      await insertPending('agent-1');
      await invokeAgentUpdateStatus('agent-1' as AgentId, { status: 'running' });

      const error = await rejection(
        invokeWorkflowNodeRoutingUpdate({
          nodeKind: 'agent',
          id: 'agent-1' as AgentId,
          routingLock: null,
          routingDecision: decision,
          taskProfile: null,
          providerOverride: 'codex',
          modelOverride: 'gpt-5.6',
          effort: 'high',
        }),
      );

      expect(error.kind).toBe('node_not_mutable');
      expect(error.message).toBe('workflow node cannot be changed: agent-1');
    });

    it('re-routes a pending agent and a step', async () => {
      await insertPending('agent-1');
      const saved = await invokeWorkflowUpsert({
        workspaceId,
        name: 'Close the books',
        description: 'Reconcile the ledger',
        steps: [{ ordinal: 0, name: 'Reconcile', promptPrefix: 'x' }],
      });
      const stepId = saved.steps[0]!.id as StepId;
      const routing = {
        routingLock: null,
        routingDecision: decision,
        taskProfile: null,
        providerOverride: 'codex',
        modelOverride: 'gpt-5.6',
        effort: 'high',
      } as const;

      await invokeWorkflowNodeRoutingUpdate({
        nodeKind: 'agent',
        id: 'agent-1' as AgentId,
        ...routing,
      });
      await invokeWorkflowNodeRoutingUpdate({ nodeKind: 'step', id: stepId, ...routing });

      const [agent] = await invokeAgentList(sessionId);
      expect(agent?.routingDecision).toEqual(decision);
      const [step] = await rowsOf<{ model_override: string }>({
        sql: 'SELECT model_override FROM steps WHERE id = ?',
        params: [stepId],
      });
      expect(step?.model_override).toBe('gpt-5.6');
    });
  });
});
