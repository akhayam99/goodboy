import { describe, expect, it } from 'vitest';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { AUTO_SEED_NOW, AUTO_SEED_SESSION, seedAutoSession } from '../test-helpers/auto-seeds';
import { readRunCostUsd } from './auto-cost';

const database = async () => {
  const db = await makeMigratedTestDatabase();
  await seedAutoSession({ db });
  for (const runId of ['run-priced', 'run-silent']) {
    await db.execute(
      'INSERT INTO provider_runs (id, session_id, provider, model, status_kind, status_payload, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [runId, AUTO_SEED_SESSION, 'anthropic', 'claude-sonnet-5', 'succeeded', '{}', AUTO_SEED_NOW],
    );
  }
  for (const [id, cost] of [
    ['telemetry-1', 0.25],
    ['telemetry-2', 0.5],
  ] as const) {
    await db.execute(
      `INSERT INTO telemetry_records
        (id, run_id, session_id, kind, provider, model, input_tokens, output_tokens, estimated_cost_usd, recorded_at)
       VALUES (?, 'run-priced', ?, 'turn', 'anthropic', 'claude-sonnet-5', 1, 1, ?, ?)`,
      [id, AUTO_SEED_SESSION, cost, AUTO_SEED_NOW],
    );
  }
  return db;
};

describe('the cost of one run', () => {
  it('adds up what the run reported', async () => {
    expect(await readRunCostUsd({ db: await database(), runId: 'run-priced' })).toBe(0.75);
  });

  it('is unknown, never zero, for a run that reported nothing', async () => {
    const db = await database();
    expect(await readRunCostUsd({ db, runId: 'run-silent' })).toBeNull();
    expect(await readRunCostUsd({ db, runId: 'run-missing' })).toBeNull();
  });
});
