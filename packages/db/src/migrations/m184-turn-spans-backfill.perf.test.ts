import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { migrations } from './index';
import { migrate } from './runner';

const BUDGET_MS = 5_000;

const seedBase = async ({ db }: { readonly db: Database }): Promise<void> => {
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Harborline', 'harborline', 1, 1)",
  );
  await db.execute(
    "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('session', 'workspace', 'Settle the ledger', 'idle', 1, 1)",
  );
  await db.execute(
    "INSERT INTO agents (id, session_id, ordinal, name, status, kind) VALUES ('implementer', 'session', 1, 'Implementer', 'completed', 'implementer'), ('debugger', 'session', 2, 'Debugger', 'idle', 'debugger'), ('chat', 'session', 3, 'Agent', 'idle', NULL)",
  );
};

describe('m184 turn spans backfill, performance', () => {
  it('backfills thousands of runs among many unrelated events within the budget', async () => {
    const db = await makeMigratedTestDatabase({ throughVersion: 173 });
    await seedBase({ db });
    const runCount = 7_000;
    for (let index = 0; index < runCount; index += 1) {
      const runId = crypto.randomUUID();
      const createdAt = 1_000 + index * 10_000;
      await db.execute(
        'INSERT INTO provider_runs (id, session_id, provider, model, status_kind, status_payload, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          runId,
          'session',
          'anthropic',
          'claude-sonnet-5',
          'succeeded',
          JSON.stringify({ finishedAt: createdAt + 5_000 }),
          createdAt,
        ],
      );
      const agentId = index % 2 === 0 ? 'implementer' : 'chat';
      await db.execute(
        'INSERT INTO turn_events (id, session_id, agent_id, payload, created_at) VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)',
        [
          `${runId}-text`,
          'session',
          agentId,
          JSON.stringify({ kind: 'assistant_text', runId, delta: 'x'.repeat(2_000), at: 'now' }),
          createdAt,
          `${runId}-tool`,
          'session',
          agentId,
          JSON.stringify({ kind: 'tool_call_end', runId, output: 'done', isError: false }),
          createdAt,
          `${runId}-done`,
          'session',
          agentId,
          JSON.stringify({ kind: 'done', runId, at: 'now' }),
          createdAt,
        ],
      );
    }

    const startedAt = performance.now();
    await migrate(db, migrations);
    const elapsedMs = performance.now() - startedAt;

    expect(
      await db.select(
        'SELECT COUNT(*) AS count, SUM(ended_at - started_at) AS total FROM agent_turn_spans',
      ),
    ).toEqual([{ count: runCount, total: runCount * 5_000 }]);
    expect(elapsedMs).toBeLessThan(BUDGET_MS);
  }, 60_000);
});
