import { brandId, type MountId } from '@goodboy/types';
import { describe, expect, it } from 'vitest';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { AUTO_SEED_NOW, AUTO_SEED_SESSION, seedAutoSession } from '../test-helpers/auto-seeds';
import { isWorkEventKind, listScriptLedger, listWorkEvents } from './work-events';

type Database = Awaited<ReturnType<typeof makeMigratedTestDatabase>>;

type InsertParams = {
  readonly db: Database;
  readonly runId: string;
  readonly kind?: string;
  readonly mountId?: string | null;
  readonly scriptId?: string;
  readonly startedAt: number;
  readonly exitCode?: number | null;
};

const PAYMENTS = brandId<MountId>({ value: 'mount-payments-api' });
const LEDGER = brandId<MountId>({ value: 'mount-ledger-core' });

const insertEvent = async ({
  db,
  runId,
  kind = 'script',
  mountId = PAYMENTS,
  scriptId = 'test:integration',
  startedAt,
  exitCode = null,
}: InsertParams): Promise<void> => {
  await db.execute(
    `INSERT INTO work_events
       (id, run_id, session_id, mount_id, kind, started_at, ended_at, exit_code, payload_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      `event-${runId}`,
      runId,
      AUTO_SEED_SESSION,
      mountId,
      kind,
      startedAt,
      exitCode === null ? null : startedAt + 1000,
      exitCode,
      JSON.stringify({ scriptId, name: scriptId }),
      startedAt,
      startedAt,
    ],
  );
};

const seeded = async (): Promise<Database> => {
  const db = await makeMigratedTestDatabase();
  await seedAutoSession({ db });
  return db;
};

describe('the work events of a session', () => {
  it('lists the newest run first and filters by mount without reading the payload', async () => {
    const db = await seeded();
    await insertEvent({ db, runId: 'run-1', startedAt: AUTO_SEED_NOW, exitCode: 0 });
    await insertEvent({ db, runId: 'run-2', mountId: LEDGER, startedAt: AUTO_SEED_NOW + 5 });

    const all = await listWorkEvents({ db, sessionId: AUTO_SEED_SESSION, limit: 10 });
    const payments = await listWorkEvents({
      db,
      sessionId: AUTO_SEED_SESSION,
      mountId: PAYMENTS,
      limit: 10,
    });

    expect(all.map((event) => event.runId)).toEqual(['run-2', 'run-1']);
    expect(payments).toEqual([
      expect.objectContaining({
        runId: 'run-1',
        mountId: PAYMENTS,
        kind: 'script',
        exitCode: 0,
        endedAt: AUTO_SEED_NOW + 1000,
        payload: { scriptId: 'test:integration', name: 'test:integration' },
      }),
    ]);
  });

  it('drops a kind TypeScript does not know', async () => {
    const db = await seeded();
    await insertEvent({ db, runId: 'run-1', kind: 'port-opened', startedAt: AUTO_SEED_NOW });

    expect(await listWorkEvents({ db, sessionId: AUTO_SEED_SESSION, limit: 10 })).toEqual([]);
    expect(isWorkEventKind({ value: 'port-opened' })).toBe(false);
    expect(isWorkEventKind({ value: 'command' })).toBe(true);
  });
});

describe('the script ledger of a session', () => {
  it('keeps the last run of each script per mount and counts its runs', async () => {
    const db = await seeded();
    await insertEvent({ db, runId: 'run-1', startedAt: AUTO_SEED_NOW, exitCode: 1 });
    await insertEvent({ db, runId: 'run-2', startedAt: AUTO_SEED_NOW + 10, exitCode: 0 });
    await insertEvent({ db, runId: 'run-3', mountId: LEDGER, startedAt: AUTO_SEED_NOW + 20 });
    await insertEvent({
      db,
      runId: 'run-4',
      scriptId: 'lint',
      startedAt: AUTO_SEED_NOW + 30,
      exitCode: 0,
    });
    await insertEvent({ db, runId: 'run-5', kind: 'command', startedAt: AUTO_SEED_NOW + 40 });

    const ledger = await listScriptLedger({ db, sessionId: AUTO_SEED_SESSION });

    expect(ledger).toEqual([
      {
        scriptId: 'lint',
        runId: 'run-4',
        mountId: PAYMENTS,
        startedAt: AUTO_SEED_NOW + 30,
        endedAt: AUTO_SEED_NOW + 1030,
        exitCode: 0,
        runCount: 1,
      },
      {
        scriptId: 'test:integration',
        runId: 'run-3',
        mountId: LEDGER,
        startedAt: AUTO_SEED_NOW + 20,
        endedAt: null,
        exitCode: null,
        runCount: 1,
      },
      {
        scriptId: 'test:integration',
        runId: 'run-2',
        mountId: PAYMENTS,
        startedAt: AUTO_SEED_NOW + 10,
        endedAt: AUTO_SEED_NOW + 1010,
        exitCode: 0,
        runCount: 2,
      },
    ]);
  });

  it('reads nothing for a session that never ran a script', async () => {
    const db = await seeded();

    expect(await listScriptLedger({ db, sessionId: AUTO_SEED_SESSION })).toEqual([]);
  });
});
