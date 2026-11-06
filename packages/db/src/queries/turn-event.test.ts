import { beforeEach, describe, expect, it } from 'vitest';
import type { AgentId, IsoDateTime, ProviderRunId, SessionId, WorkspaceId } from '@goodboy/types';
import type { Database } from '../client';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import {
  countUserTextEvents,
  findUndecidedPermissionAsk,
  insertTurnEvent,
  listTurnEventEntriesForAgent,
  listTurnEventsForAgent,
  listUndecidedAskRunIds,
  readFirstUserText,
} from './turn-event';

const workspaceId = 'workspace-1' as WorkspaceId;
const sessionId = 'session-1' as SessionId;
const agentId = 'agent-1' as AgentId;
const otherAgentId = 'agent-2' as AgentId;
const runId = 'run-1' as ProviderRunId;
const at = '2026-07-30T10:00:00.000Z' as IsoDateTime;

describe('turn event queries', () => {
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
    await db.execute(
      `INSERT INTO agents (id, session_id, ordinal, name, status)
       VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)`,
      [
        agentId,
        sessionId,
        0,
        'agent one',
        'pending',
        otherAgentId,
        sessionId,
        1,
        'agent two',
        'pending',
      ],
    );
  });

  it('finds a delivered turn by its delivery id for that agent only', async () => {
    await insertTurnEvent(db, {
      id: 'event-1',
      sessionId,
      agentId,
      event: { kind: 'user_text', runId, text: 'queued', deliveryId: 'queue:q1', at },
    });
    await insertTurnEvent(db, {
      id: 'event-2',
      sessionId,
      agentId,
      event: { kind: 'user_text', runId, text: 'plain', at },
    });

    await expect(countUserTextEvents({ db, agentId, deliveryId: 'queue:q1' })).resolves.toBe(1);
    await expect(countUserTextEvents({ db, agentId, deliveryId: 'queue:q2' })).resolves.toBe(0);
    await expect(
      countUserTextEvents({ db, agentId: otherAgentId, deliveryId: 'queue:q1' }),
    ).resolves.toBe(0);
    await expect(countUserTextEvents({ db, agentId })).resolves.toBe(2);
  });

  it('counts only user_text payloads for the requested agent', async () => {
    await insertTurnEvent(db, {
      id: 'event-1',
      sessionId,
      agentId,
      event: { kind: 'user_text', runId, text: 'first', at },
    });
    await insertTurnEvent(db, {
      id: 'event-2',
      sessionId,
      agentId,
      event: { kind: 'assistant_text', runId, delta: 'reply', at },
    });
    await insertTurnEvent(db, {
      id: 'event-3',
      sessionId,
      agentId,
      event: { kind: 'user_text', runId, text: 'second', at },
    });
    await insertTurnEvent(db, {
      id: 'event-4',
      sessionId,
      agentId: otherAgentId,
      event: { kind: 'user_text', runId, text: 'other agent', at },
    });

    await expect(countUserTextEvents({ db, agentId })).resolves.toBe(2);
    await expect(countUserTextEvents({ db, agentId: otherAgentId })).resolves.toBe(1);
  });

  it('reads the first user_text of one agent, or null when it has none', async () => {
    await insertTurnEvent(db, {
      id: 'event-1',
      sessionId,
      agentId,
      event: { kind: 'assistant_text', runId, delta: 'reply', at },
    });
    await insertTurnEvent(db, {
      id: 'event-2',
      sessionId,
      agentId,
      event: { kind: 'user_text', runId, text: 'Fix the ledger-core retry', at },
    });
    await insertTurnEvent(db, {
      id: 'event-3',
      sessionId,
      agentId,
      event: { kind: 'user_text', runId, text: 'second', at },
    });

    await expect(readFirstUserText({ db, agentId })).resolves.toBe('Fix the ledger-core retry');
    await expect(readFirstUserText({ db, agentId: otherAgentId })).resolves.toBeNull();
  });

  it('reads the operator ask before any user_text, and never a delivery Auto sent', async () => {
    await insertTurnEvent(db, {
      id: 'event-delivered',
      sessionId,
      agentId,
      event: { kind: 'user_text', runId, text: 'Artifacts in this tree', deliveredBy: 'auto', at },
    });
    await insertTurnEvent(db, {
      id: 'event-legacy',
      sessionId,
      agentId,
      event: { kind: 'user_text', runId, text: 'legacy text', at },
    });
    await insertTurnEvent(db, {
      id: 'event-ask',
      sessionId,
      agentId,
      event: { kind: 'operator_text', runId, text: 'Add refunds to payments-api', at },
    });
    await insertTurnEvent(db, {
      id: 'event-delivered-only',
      sessionId,
      agentId: otherAgentId,
      event: { kind: 'user_text', runId, text: 'Artifacts in this tree', deliveredBy: 'auto', at },
    });

    await expect(readFirstUserText({ db, agentId })).resolves.toBe('Add refunds to payments-api');
    await expect(readFirstUserText({ db, agentId: otherAgentId })).resolves.toBeNull();
  });

  it('keeps who delivered a user_text, and never counts the operator echo as a turn', async () => {
    await insertTurnEvent(db, {
      id: 'event-delivered',
      sessionId,
      agentId,
      event: {
        kind: 'user_text',
        runId,
        text: 'STATE OF THIS CONVERSATION',
        deliveredBy: 'auto',
        at,
      },
    });
    await insertTurnEvent(db, {
      id: 'event-echo',
      sessionId,
      agentId,
      event: { kind: 'operator_text', runId, text: 'Also cover refunds.', at },
    });
    await insertTurnEvent(db, {
      id: 'event-huge',
      sessionId,
      agentId,
      event: {
        kind: 'user_text',
        runId,
        text: 'x'.repeat(2_000_000),
        deliveredBy: 'auto',
        at,
      },
    });

    const events = await listTurnEventsForAgent(db, agentId);

    expect(events.map((event) => event.kind)).toEqual(['user_text', 'operator_text', 'user_text']);
    expect(events[0]).toMatchObject({ deliveredBy: 'auto' });
    expect(events[2]).toMatchObject({ deliveredBy: 'auto' });
    await expect(countUserTextEvents({ db, agentId })).resolves.toBe(2);
  });

  it('finds the ask of a run that nobody decided, and none once it was decided', async () => {
    const ask = (toolUseId: string, id: string) =>
      insertTurnEvent(db, {
        id,
        sessionId,
        agentId,
        event: {
          kind: 'permission_request',
          runId,
          toolUseId,
          toolName: 'Bash',
          input: { command: 'pnpm test' },
          at,
        },
      });
    await ask('tool-1', 'event-ask-1');
    await insertTurnEvent(db, {
      id: 'event-decision-1',
      sessionId,
      agentId,
      event: {
        kind: 'permission_decision',
        runId,
        toolUseId: 'tool-1',
        decision: 'allow',
        ruleId: null,
        decidedBy: 'user',
        at,
      },
    });

    expect(await findUndecidedPermissionAsk({ db, agentId, runId })).toBeNull();

    await ask('tool-2', 'event-ask-2');

    expect(await findUndecidedPermissionAsk({ db, agentId, runId })).toEqual({
      runId,
      toolUseId: 'tool-2',
      at,
    });
    expect(await findUndecidedPermissionAsk({ db, agentId: otherAgentId, runId })).toBeNull();
  });

  it('lists the run of a running agent whose ask nobody decided, and no other run', async () => {
    const otherRunId = 'run-2' as ProviderRunId;
    await db.execute(`UPDATE agents SET status = 'running', provider_run_id = ? WHERE id = ?`, [
      runId,
      agentId,
    ]);
    await db.execute(`UPDATE agents SET status = 'running', provider_run_id = ? WHERE id = ?`, [
      otherRunId,
      otherAgentId,
    ]);
    type AskParams = {
      readonly id: string;
      readonly owner: AgentId;
      readonly run: ProviderRunId;
      readonly toolUseId: string;
    };
    const ask = ({ id, owner, run, toolUseId }: AskParams) =>
      insertTurnEvent(db, {
        id,
        sessionId,
        agentId: owner,
        event: {
          kind: 'permission_request',
          runId: run,
          toolUseId,
          toolName: 'Bash',
          input: { command: 'pnpm test' },
          at,
        },
      });
    await ask({ id: 'event-ask-1', owner: agentId, run: runId, toolUseId: 'tool-1' });
    await ask({ id: 'event-ask-2', owner: otherAgentId, run: otherRunId, toolUseId: 'tool-2' });
    await insertTurnEvent(db, {
      id: 'event-decision-2',
      sessionId,
      agentId: otherAgentId,
      event: {
        kind: 'permission_decision',
        runId: otherRunId,
        toolUseId: 'tool-2',
        decision: 'deny',
        ruleId: null,
        decidedBy: 'user',
        at,
      },
    });

    expect(await listUndecidedAskRunIds({ db })).toEqual([runId]);

    await db.execute(`UPDATE agents SET status = 'stopped' WHERE id = ?`, [agentId]);

    expect(await listUndecidedAskRunIds({ db })).toEqual([]);
  });

  it('lists the stored id with each event of one agent, oldest first', async () => {
    await insertTurnEvent(db, {
      id: 'event-first',
      sessionId,
      agentId,
      event: { kind: 'user_text', runId, text: 'Reconcile Harborline', at },
    });
    await insertTurnEvent(db, {
      id: 'event-second',
      sessionId,
      agentId,
      event: { kind: 'assistant_text', runId, delta: 'Done.', at },
    });
    await insertTurnEvent(db, {
      id: 'event-other',
      sessionId,
      agentId: otherAgentId,
      event: { kind: 'user_text', runId, text: 'Another agent', at },
    });

    const entries = await listTurnEventEntriesForAgent({ db, agentId });

    expect(entries.map((entry) => entry.id)).toEqual(['event-first', 'event-second']);
    expect(entries.map((entry) => entry.event.kind)).toEqual(['user_text', 'assistant_text']);
  });

  it('round-trips the operator note stored on an orchestrator decision', async () => {
    await insertTurnEvent(db, {
      id: 'event-5',
      sessionId,
      agentId,
      event: {
        kind: 'orchestrator_decision',
        runId,
        action: 'next',
        reason: 'the tests come next',
        stepName: 'write the gate tests',
        operatorNote: 'the gate is in place but its tests are missing',
        at,
      },
    });

    const events = await listTurnEventsForAgent(db, agentId);
    const decision = events.find((event) => event.kind === 'orchestrator_decision');
    expect(decision).toBeDefined();
    if (decision?.kind !== 'orchestrator_decision') {
      return;
    }
    expect(decision.operatorNote).toBe('the gate is in place but its tests are missing');
  });

  it('does not persist unknown provider payloads', async () => {
    await insertTurnEvent(db, {
      id: 'event-unknown',
      sessionId,
      agentId,
      event: {
        kind: 'unknown_payload',
        runId,
        adapter: 'provider',
        payloadType: 'rate_limit',
        raw: { message: 'noise' },
        at,
      },
    });

    await expect(listTurnEventsForAgent(db, agentId)).resolves.toEqual([]);
  });

  it('stores oversized payloads as valid bounded events with a marker', async () => {
    await insertTurnEvent(db, {
      id: 'event-large',
      sessionId,
      agentId,
      event: {
        kind: 'tool_call_end',
        runId,
        toolUseId: 'tool-large',
        output: { body: 'x'.repeat(100_000) },
        isError: false,
        at,
      },
    });

    const rows = await db.select<{ payload: string }>(
      'SELECT payload FROM turn_events WHERE id = ?',
      ['event-large'],
    );
    const events = await listTurnEventsForAgent(db, agentId);
    expect(new TextEncoder().encode(rows[0]?.payload).byteLength).toBeLessThanOrEqual(64 * 1024);
    expect(events[0]).toMatchObject({ kind: 'tool_call_end', output: '…[truncated]' });
  });

  it('keeps how an oversized queued message was sent', async () => {
    await insertTurnEvent(db, {
      id: 'event-large-queued',
      sessionId,
      agentId,
      event: { kind: 'user_text', runId, text: 'x'.repeat(100_000), sentVia: 'queued', at },
    });

    const events = await listTurnEventsForAgent(db, agentId);
    expect(events[0]).toMatchObject({ kind: 'user_text', sentVia: 'queued' });
  });
});
