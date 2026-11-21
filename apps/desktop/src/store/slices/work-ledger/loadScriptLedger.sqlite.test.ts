// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).sqliteDbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTO_SEED_SESSION, seedAutoSession } from '@goodboy/db/test-helpers/auto-seeds';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  openStorySqlite,
  resetStoryStore,
  storySqlite,
  type StoryStore,
} from '../../storyHarness';

type RunParams = {
  readonly runId: string;
  readonly startedAt: number;
  readonly exitCode: number | null;
};

let useAppStore: StoryStore;

const writeRun = async ({ runId, startedAt, exitCode }: RunParams): Promise<void> => {
  await storySqlite().execute(
    `INSERT INTO work_events
       (id, run_id, session_id, mount_id, kind, started_at, ended_at, exit_code, payload_json, created_at, updated_at)
     VALUES (?, ?, ?, 'mount-payments-api', 'script', ?, ?, ?, ?, ?, ?)
     ON CONFLICT (run_id) DO UPDATE SET ended_at = excluded.ended_at, exit_code = excluded.exit_code`,
    [
      `event-${runId}`,
      runId,
      AUTO_SEED_SESSION,
      startedAt,
      exitCode === null ? null : startedAt + 100,
      exitCode,
      JSON.stringify({ scriptId: 'test:integration', name: 'test:integration' }),
      startedAt,
      startedAt,
    ],
  );
};

const ledger = () => useAppStore.getState().scriptLedger[AUTO_SEED_SESSION] ?? [];

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  await openStorySqlite();
  await seedAutoSession({ db: storySqlite() });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('loadScriptLedger', () => {
  it('reads the last run of each script of the session it names', async () => {
    await writeRun({ runId: 'run-1', startedAt: 10, exitCode: 1 });
    await writeRun({ runId: 'run-2', startedAt: 20, exitCode: null });

    await useAppStore.getState().loadScriptLedger({ sessionId: AUTO_SEED_SESSION });

    expect(ledger()).toEqual([
      expect.objectContaining({
        scriptId: 'test:integration',
        runId: 'run-2',
        exitCode: null,
        runCount: 2,
      }),
    ]);
  });

  it('picks up the end of a run on the next read and keeps the same rows when nothing moved', async () => {
    await writeRun({ runId: 'run-1', startedAt: 10, exitCode: null });
    await useAppStore.getState().loadScriptLedger({ sessionId: AUTO_SEED_SESSION });
    await writeRun({ runId: 'run-1', startedAt: 10, exitCode: 0 });

    await useAppStore.getState().loadScriptLedger({ sessionId: AUTO_SEED_SESSION });
    const ended = ledger();
    await useAppStore.getState().loadScriptLedger({ sessionId: AUTO_SEED_SESSION });

    expect(ended).toEqual([expect.objectContaining({ runId: 'run-1', exitCode: 0, endedAt: 110 })]);
    expect(ledger()).toBe(ended);
  });

  it('keeps only the newest answer when two reads cross', async () => {
    await writeRun({ runId: 'run-1', startedAt: 10, exitCode: 1 });
    const older = useAppStore.getState().loadScriptLedger({ sessionId: AUTO_SEED_SESSION });
    await writeRun({ runId: 'run-2', startedAt: 20, exitCode: 0 });
    const newer = useAppStore.getState().loadScriptLedger({ sessionId: AUTO_SEED_SESSION });

    await Promise.all([older, newer]);

    expect(ledger().map((entry) => entry.runId)).toEqual(['run-2']);
  });

  it('leaves the rows it had when a read fails', async () => {
    await writeRun({ runId: 'run-1', startedAt: 10, exitCode: 0 });
    await useAppStore.getState().loadScriptLedger({ sessionId: AUTO_SEED_SESSION });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await storySqlite().execute('ALTER TABLE work_events RENAME TO work_events_gone');

    await useAppStore.getState().loadScriptLedger({ sessionId: AUTO_SEED_SESSION });

    expect(ledger().map((entry) => entry.runId)).toEqual(['run-1']);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
