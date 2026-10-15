import { describe, expect, it } from 'vitest';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import {
  AUTO_SEED_NOW,
  AUTO_SEED_ROOT,
  AUTO_SEED_SESSION,
  seedAutoSession,
} from '../test-helpers/auto-seeds';
import { readRunLedgerOutcome } from './auto-run-outcome';

const RUNS: ReadonlyArray<readonly [string, string, string]> = [
  ['run-ok', 'succeeded', '{}'],
  ['run-cut', 'failed', '{"error":"cancelled by user"}'],
  ['run-broken', 'failed', '{"error":"provider exited"}'],
  ['run-garbled', 'failed', 'not json'],
  ['run-stopped', 'cancelled', '{}'],
  ['run-live', 'streaming', '{}'],
];

const database = async () => {
  const db = await makeMigratedTestDatabase();
  await seedAutoSession({ db });
  for (const [id, kind, payload] of RUNS) {
    await db.execute(
      'INSERT INTO provider_runs (id, session_id, provider, model, status_kind, status_payload, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, AUTO_SEED_SESSION, 'anthropic', 'claude-sonnet-5', kind, payload, AUTO_SEED_NOW],
    );
  }
  await db.execute(
    `INSERT INTO messages (id, session_id, agent_id, role, content, created_at)
     VALUES ('message-old', ?, ?, 'assistant', 'An answer from before.', ?),
            ('message-new', ?, ?, 'assistant', 'Added the export.', ?),
            ('message-user', ?, ?, 'user', 'Please add the export.', ?)`,
    [
      AUTO_SEED_SESSION,
      AUTO_SEED_ROOT,
      AUTO_SEED_NOW - 5_000,
      AUTO_SEED_SESSION,
      AUTO_SEED_ROOT,
      AUTO_SEED_NOW + 5_000,
      AUTO_SEED_SESSION,
      AUTO_SEED_ROOT,
      AUTO_SEED_NOW + 6_000,
    ],
  );
  await db.execute(
    `INSERT INTO telemetry_records
      (id, run_id, session_id, kind, provider, model, input_tokens, output_tokens, estimated_cost_usd, recorded_at)
     VALUES ('telemetry-1', 'run-ok', ?, 'turn', 'anthropic', 'claude-sonnet-5', 1, 1, 0.25, ?)`,
    [AUTO_SEED_SESSION, AUTO_SEED_NOW],
  );
  return db;
};

const outcomeOf = async (runId: string) =>
  readRunLedgerOutcome({ db: await database(), runId, agentId: AUTO_SEED_ROOT });

describe('what a finished run left behind', () => {
  it('reads the last assistant reply after the run started, and its cost', async () => {
    expect(await outcomeOf('run-ok')).toEqual({
      assistantText: 'Added the export.',
      exit: 'ok',
      costUsd: 0.25,
    });
  });

  it('tells a cancelled run from a broken one', async () => {
    expect(await outcomeOf('run-cut')).toMatchObject({ exit: 'cancelled' });
    expect(await outcomeOf('run-stopped')).toMatchObject({ exit: 'cancelled' });
    expect(await outcomeOf('run-broken')).toMatchObject({ exit: 'error' });
    expect(await outcomeOf('run-garbled')).toMatchObject({ exit: 'error' });
  });

  it('knows nothing of a run that is still going or was never recorded', async () => {
    expect(await outcomeOf('run-live')).toBeNull();
    expect(await outcomeOf('run-missing')).toBeNull();
  });

  it('has no text and no cost for a run whose agent said nothing since it started', async () => {
    const db = await database();
    const outcome = await readRunLedgerOutcome({
      db,
      runId: 'run-stopped',
      agentId: 'agent-nobody',
    });
    expect(outcome).toEqual({ assistantText: '', exit: 'cancelled', costUsd: null });
  });
});
