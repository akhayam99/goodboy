import { beforeEach, describe, expect, it, vi } from 'vitest';
import { brandId, type AgentId, type SessionId, type WorkspaceId } from '@goodboy/types';
import type { Database } from '../client';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { listAgentsForSessions, purgeAgentForDelete } from './agent';
import { listAgentOutputSummaries, listAgentSummariesForSessions } from './agent-summary';

const workspaceId = brandId<WorkspaceId>({ value: 'workspace-harborline' });
const ledgerId = brandId<SessionId>({ value: 'session-ledger' });
const relayId = brandId<SessionId>({ value: 'session-relay' });
const writerId = brandId<AgentId>({ value: 'agent-writer' });
const reviewerId = brandId<AgentId>({ value: 'agent-reviewer' });
const relayAgentId = brandId<AgentId>({ value: 'agent-relay' });
const HEAVY_KEYS = [
  'outputSummary',
  'domains',
  'sourceThreadIds',
  'routingLock',
  'routingDecision',
  'taskProfile',
] as const;

type SeedParams = {
  readonly id: AgentId;
  readonly sessionId: SessionId;
  readonly ordinal: number;
  readonly summary: string | null;
};

describe('agent summaries', () => {
  let db: Database;

  const seedAgent = async ({ id, sessionId, ordinal, summary }: SeedParams): Promise<void> => {
    await db.execute(
      `INSERT INTO agents (
         id, session_id, ordinal, name, status, output_summary, provider_run_id,
         provider_session_id, provider_session_provider_id, kind, last_finished_at,
         last_viewed_at, model_override, provider_override, effort, source_thread_id,
         source_thread_ids, domains_json, routing_decision
       ) VALUES (?, ?, ?, ?, 'completed', ?, ?, ?, 'codex', 'implementer', ?, ?, ?, 'codex',
         'high', 'thread-1', ?, ?, ?)`,
      [
        id,
        sessionId,
        ordinal,
        `agent ${ordinal}`,
        summary,
        `run-${id}`,
        `codex-${id}`,
        1_000 + ordinal,
        500,
        'gpt-6',
        JSON.stringify(['thread-1', 'thread-2']),
        JSON.stringify(['ledger-core']),
        null,
      ],
    );
  };

  beforeEach(async () => {
    db = await makeMigratedTestDatabase();
    const now = Date.now();
    await db.execute(
      'INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [workspaceId, 'Harborline', '/tmp/harborline', now, now],
    );
    for (const id of [ledgerId, relayId]) {
      await db.execute(
        'INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        [id, workspaceId, 'Reconcile ledger-core', 'idle', now, now],
      );
    }
    await seedAgent({
      id: writerId,
      sessionId: ledgerId,
      ordinal: 0,
      summary: 'Wrote the importer.',
    });
    await seedAgent({ id: reviewerId, sessionId: ledgerId, ordinal: 1, summary: null });
    await seedAgent({ id: relayAgentId, sessionId: relayId, ordinal: 0, summary: 'Queued it.' });
  });

  it('reads no summary text and no JSON column', async () => {
    const select = vi.spyOn(db, 'select');

    await listAgentSummariesForSessions({ db, sessionIds: [ledgerId, relayId] });

    const [sql] = select.mock.calls[0] ?? [''];
    expect(sql).not.toContain('*');
    for (const column of [
      'output_summary',
      'domains_json',
      'source_thread_ids',
      'routing_lock',
      'routing_decision',
      'task_profile',
    ]) {
      expect(sql).not.toContain(column);
    }
  });

  it('equals the full row without its heavy fields, in the same order', async () => {
    const full = await listAgentsForSessions(db, [ledgerId, relayId]);
    const summaries = await listAgentSummariesForSessions({ db, sessionIds: [ledgerId, relayId] });

    const expected = [...(full.get(ledgerId) ?? []), ...(full.get(relayId) ?? [])].map((agent) => {
      const light: Record<string, unknown> = { ...agent };
      for (const key of HEAVY_KEYS) {
        Reflect.deleteProperty(light, key);
      }
      return light;
    });
    expect(summaries).toEqual(expected);
    expect(summaries.some((agent) => 'outputSummary' in agent)).toBe(false);
  });

  it('skips a tombstoned agent', async () => {
    await purgeAgentForDelete({ db, id: reviewerId });

    const summaries = await listAgentSummariesForSessions({ db, sessionIds: [ledgerId] });

    expect(summaries.map((agent) => agent.id)).toEqual([writerId]);
  });

  it('reads the summary text of the agents it is given and of nothing else', async () => {
    const texts = await listAgentOutputSummaries({ db, agentIds: [writerId, reviewerId] });

    expect(texts).toEqual([{ agentId: writerId, outputSummary: 'Wrote the importer.' }]);
    expect(await listAgentOutputSummaries({ db, agentIds: [] })).toEqual([]);
  });
});
