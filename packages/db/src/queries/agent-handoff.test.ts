import { beforeEach, describe, expect, it } from 'vitest';
import type { AgentHandoff, AgentId, IsoDateTime, WorkflowRunId } from '@goodboy/types';
import type { Database } from '../client';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { getAgentHandoff, insertAgentHandoff } from './agent-handoff';

const AGENT = 'agent-4' as AgentId;

const handoff = (): AgentHandoff => ({
  agentId: AGENT,
  sender: {
    kind: 'workflowStep',
    workflowRunId: 'run-1' as WorkflowRunId,
    stepOrdinal: 3,
    stepCount: 5,
  },
  ask: 'Round once per batch in ledger-core.',
  why: null,
  doneWhen: 'Totals match on the fixture batch.',
  sections: [
    { kind: 'ask', summary: 'Round once per batch.', bodyMd: 'Round once per batch.', refs: [] },
  ],
  sentSystem: null,
  sentMessage: '[projects-scope]\nWrites ledger-core.\n[/projects-scope]\n\nRound once per batch.',
  provider: 'codex',
  createdAt: '2026-09-25T11:41:00.000Z' as IsoDateTime,
});

describe('agent handoff queries', () => {
  let db: Database;

  beforeEach(async () => {
    db = await makeMigratedTestDatabase();
    await db.execute(
      "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Harborline', 'harborline', 1, 1)",
    );
    await db.execute(
      "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('session', 'workspace', 'Settle', 'idle', 1, 1)",
    );
    await db.execute(
      "INSERT INTO agents (id, session_id, ordinal, name, status) VALUES ('agent-4', 'session', 4, 'Implementer', 'running')",
    );
  });

  it('reads back exactly what was stored', async () => {
    await insertAgentHandoff({ db, handoff: handoff() });

    expect(await getAgentHandoff({ db, agentId: AGENT })).toEqual(handoff());
  });

  it('keeps the first handoff when a later turn tries to write another', async () => {
    await insertAgentHandoff({ db, handoff: handoff() });
    await insertAgentHandoff({ db, handoff: { ...handoff(), ask: 'Something else.' } });

    expect((await getAgentHandoff({ db, agentId: AGENT }))?.ask).toBe(
      'Round once per batch in ledger-core.',
    );
  });

  it('returns null for an agent spawned before handoffs were stored', async () => {
    expect(await getAgentHandoff({ db, agentId: AGENT })).toBeNull();
  });

  it('falls back when a stored column is malformed', async () => {
    await db.execute(
      `INSERT INTO agent_handoffs (agent_id, sender_json, ask, sections_json, sent_message, provider, created_at)
       VALUES ('agent-4', '{"kind":"alien"}', 'Trace it.', '[{"kind":"alien"}]', 'Trace it.', 'anthropic', 1)`,
    );

    const read = await getAgentHandoff({ db, agentId: AGENT });
    expect(read?.sender).toEqual({ kind: 'you' });
    expect(read?.sections).toEqual([]);
  });
});
