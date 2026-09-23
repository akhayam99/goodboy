import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type {
  AgentId,
  OpenQuestionId,
  PlanConsumptionId,
  PlanId,
  SessionId,
  WorkflowRoutingDecision,
  WorkflowRoutingLock,
  WorkspaceId,
} from '@goodboy/types';
import type { Database } from '../client';
import { migrate } from '../migrations/runner';
import { makeMigratedTestDatabase, makeTestDatabase } from '../test-helpers/test-db';
import {
  getAgentById,
  listAgentsForSession,
  listAgentsForSessions,
  purgeAgentForDelete,
  updateAgentRouting,
} from './agent';
import { addPlanConsumption, listConsumptionsForPlan, upsertPlan } from './plan';
import {
  insertOpenQuestion,
  listOpenQuestionsForSession,
  markOpenQuestionAnswered,
} from './open-question';

const workspaceId = 'workspace-1' as WorkspaceId;
const sessionId = 'session-1' as SessionId;
const agentId = 'agent-1' as AgentId;

describe('agent queries', () => {
  let db: Database;

  beforeEach(async () => {
    db = await makeMigratedTestDatabase();
    const now = Date.now();
    await db.execute(
      'INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [workspaceId, 'workspace', '/tmp/workspace', now, now],
    );
    await db.execute(
      'INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [sessionId, workspaceId, 'goal', 'idle', now, now],
    );
  });

  const seedAgent = async (id: AgentId, ordinal: number): Promise<void> => {
    await db.execute(
      `INSERT INTO agents (id, session_id, ordinal, name, status, output_summary)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, sessionId, ordinal, `agent ${ordinal}`, 'completed', 'summary'],
    );
  };

  it('purgeAgentForDelete drops the transcript and tombstones the agent', async () => {
    await seedAgent(agentId, 0);
    const now = Date.now();
    await db.execute(
      `INSERT INTO messages (id, session_id, agent_id, role, content, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['message-1', sessionId, agentId, 'user', 'hello', now],
    );
    await db.execute(
      `INSERT INTO turn_events (id, session_id, agent_id, payload, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      ['event-1', sessionId, agentId, '{"kind":"user_text","text":"hello"}', now],
    );

    await purgeAgentForDelete({ db, id: agentId });

    expect(await db.select('SELECT id FROM messages WHERE agent_id = ?', [agentId])).toEqual([]);
    expect(await db.select('SELECT id FROM turn_events WHERE agent_id = ?', [agentId])).toEqual([]);
    const rows = await db.select<{
      readonly deleted_at: number | null;
      readonly output_summary: string | null;
    }>('SELECT deleted_at, output_summary FROM agents WHERE id = ?', [agentId]);
    expect(rows[0]?.deleted_at).toEqual(expect.any(Number));
    expect(rows[0]?.output_summary).toBeNull();
  });

  it('purgeAgentForDelete keeps the plan the agent authored and its consumptions', async () => {
    await seedAgent(agentId, 0);
    const consumerId = 'agent-2' as AgentId;
    await seedAgent(consumerId, 1);
    const plan = await upsertPlan(db, {
      id: 'plan-1' as PlanId,
      sessionId,
      agentId,
      title: 'plan',
      bodyMd: 'body',
    });
    await addPlanConsumption(db, {
      id: 'consumption-1' as PlanConsumptionId,
      planId: plan.id,
      agentId: consumerId,
    });

    await purgeAgentForDelete({ db, id: agentId });

    expect(
      await db.select("SELECT id, agent_id FROM session_artifacts WHERE kind = 'plan'"),
    ).toEqual([{ id: 'plan-1', agent_id: agentId }]);
    const consumptions = await listConsumptionsForPlan(db, plan.id);
    expect(consumptions.map((consumption) => consumption.id)).toEqual(['consumption-1']);
  });

  it('purgeAgentForDelete takes the open questions the agent asked and leaves the settled ones', async () => {
    await seedAgent(agentId, 0);
    const survivorId = 'agent-2' as AgentId;
    await seedAgent(survivorId, 1);
    await insertOpenQuestion(db, {
      id: 'question-open' as OpenQuestionId,
      sessionId,
      createdByAgentId: agentId,
      text: 'renew the expired key?',
      suggestedAnswers: ['renew', 'drop'],
      isBlocking: true,
    });
    await insertOpenQuestion(db, {
      id: 'question-answered' as OpenQuestionId,
      sessionId,
      createdByAgentId: agentId,
      text: 'which surface leads?',
      suggestedAnswers: ['desktop', 'mobile'],
    });
    await markOpenQuestionAnswered(db, 'question-answered' as OpenQuestionId, 'desktop');
    await insertOpenQuestion(db, {
      id: 'question-other' as OpenQuestionId,
      sessionId,
      createdByAgentId: survivorId,
      text: 'what happens to the legacy route?',
      suggestedAnswers: ['keep', 'drop'],
    });

    const removed = await purgeAgentForDelete({ db, id: agentId });

    expect(removed).toEqual(['renew the expired key?']);
    const left = await listOpenQuestionsForSession(db, sessionId);
    expect(left.map((question) => question.id).sort()).toEqual([
      'question-answered',
      'question-other',
    ]);
  });

  it('hides a tombstoned agent from the listings but keeps it reachable by id', async () => {
    await seedAgent(agentId, 0);
    const survivorId = 'agent-2' as AgentId;
    await seedAgent(survivorId, 1);

    await purgeAgentForDelete({ db, id: agentId });

    const listed = await listAgentsForSession(db, sessionId);
    expect(listed.map((agent) => agent.id)).toEqual([survivorId]);
    const batched = await listAgentsForSessions(db, [sessionId]);
    expect(batched.get(sessionId)?.map((agent) => agent.id)).toEqual([survivorId]);
    expect((await getAgentById(db, agentId))?.id).toBe(agentId);
  });

  it('round-trips the provider session id and its owning provider', async () => {
    await db.execute(
      `INSERT INTO agents (
         id, session_id, ordinal, name, status, provider_session_id,
         provider_session_provider_id
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [agentId, sessionId, 0, 'agent', 'pending', 'codex-session', 'codex'],
    );

    const stored = await getAgentById(db, agentId);
    expect(stored?.providerSessionId).toBe('codex-session');
    expect(stored?.providerSessionProviderId).toBe('codex');
  });
});

const userLock: WorkflowRoutingLock = {
  version: 1,
  pick: { provider: 'codex', model: 'gpt-5.6-sol', effort: 'high' },
  origin: 'user',
};

const lockedDecision: WorkflowRoutingDecision = {
  version: 1,
  proposal: {
    pick: { provider: 'anthropic', model: 'sonnet-5', effort: 'medium' },
    reason: 'A standard implementation step fits a mid tier model.',
    source: 'agent',
    profile: { taskType: 'implementation', difficulty: 'standard', basis: 'agent' },
  },
  selected: { provider: 'codex', model: 'gpt-5.6-sol', effort: 'high' },
  source: 'step_lock',
  reason: 'This node lock selected codex/gpt-5.6-sol.',
  adjustment: 'none',
  executed: null,
};

describe('agent routing persistence', () => {
  let directory: string;
  let file: string;
  let db: Database;

  beforeEach(async () => {
    directory = mkdtempSync(join(tmpdir(), 'goodboy-routing-'));
    file = join(directory, 'routing.sqlite');
    db = makeTestDatabase(file);
    await migrate(db);
    const now = Date.now();
    await db.execute(
      'INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [workspaceId, 'workspace', '/tmp/workspace', now, now],
    );
    await db.execute(
      'INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [sessionId, workspaceId, 'goal', 'idle', now, now],
    );
    await db.execute(
      'INSERT INTO agents (id, session_id, ordinal, name, status) VALUES (?, ?, ?, ?, ?)',
      [agentId, sessionId, 0, 'agent', 'pending'],
    );
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it('a user lock and its decision survive a database reopen', async () => {
    const written = await updateAgentRouting({
      db,
      id: agentId,
      update: {
        routingLock: userLock,
        routingDecision: lockedDecision,
        taskProfile: { taskType: 'implementation', difficulty: 'standard', basis: 'agent' },
        providerOverride: 'codex',
        modelOverride: 'gpt-5.6-sol',
        effort: 'high',
      },
    });
    expect(written).toBe(true);

    const reopened = makeTestDatabase(file);
    const stored = await getAgentById(reopened, agentId);

    expect(stored?.routingLock).toEqual(userLock);
    expect(stored?.routingDecision).toEqual(lockedDecision);
    expect(stored?.taskProfile).toEqual({
      taskType: 'implementation',
      difficulty: 'standard',
      basis: 'agent',
    });
    expect(stored?.providerOverride).toBe('codex');
    expect(stored?.modelOverride).toBe('gpt-5.6-sol');
    expect(stored?.effort).toBe('high');
  });

  it('refuses to write a routing lock the codec cannot read back', async () => {
    await expect(
      updateAgentRouting({
        db,
        id: agentId,
        update: {
          routingLock: {
            version: 1,
            pick: { provider: 'nowhere', model: 'gpt-5.6-sol', effort: 'high' },
            origin: 'user',
          } as unknown as WorkflowRoutingLock,
          routingDecision: lockedDecision,
          taskProfile: null,
          providerOverride: 'codex',
          modelOverride: 'gpt-5.6-sol',
          effort: 'high',
        },
      }),
    ).rejects.toThrow('Invalid routing lock');

    const reopened = makeTestDatabase(file);
    const stored = await getAgentById(reopened, agentId);
    expect(stored?.routingLock).toBeNull();
  });
});
