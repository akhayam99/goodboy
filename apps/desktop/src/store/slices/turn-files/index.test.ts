// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../storyHarness')).dbModuleMock());
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).dbLibModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReportErrorParams } from '../notifications/reportError';
import { brandId, type MountId, type ProviderRunId, type SessionId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';

const SESSION = brandId<SessionId>({ value: 'session-harborline' });
const MOUNT = brandId<MountId>({ value: 'mount-ledger-core' });
const RUN = brandId<ProviderRunId>({ value: 'run-1' });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

describe('the files of the turns of a session', () => {
  it('keeps the paths each turn changed, per mount, with when it was recorded', async () => {
    const { listTurnFileSets } = await import('@goodboy/db');
    vi.mocked(listTurnFileSets).mockResolvedValueOnce([
      {
        runId: RUN,
        mountId: MOUNT,
        sessionId: SESSION,
        own: [
          {
            path: 'migrations/0042_add_ledger_index.sql',
            status: 'added',
            additions: 4,
            deletions: 0,
          },
        ],
        fromBase: [],
        isPartial: false,
        recordedAtMs: 1_000,
      },
    ]);
    await useAppStore.getState().loadTurnFiles({ sessionId: SESSION });
    expect(useAppStore.getState().turnFiles[SESSION]).toEqual([
      { mountId: MOUNT, paths: ['migrations/0042_add_ledger_index.sql'], recordedAtMs: 1_000 },
    ]);
  });

  it('leaves the old files in place when the read fails', async () => {
    const { listTurnFileSets } = await import('@goodboy/db');
    vi.mocked(listTurnFileSets).mockRejectedValueOnce(new Error('database is locked'));
    await expect(useAppStore.getState().loadTurnFiles({ sessionId: SESSION })).rejects.toThrow(
      'database is locked',
    );
    expect(useAppStore.getState().turnFiles[SESSION]).toBeUndefined();
  });
  it('drops an older answer that arrives after a newer one', async () => {
    const { listTurnFileSets } = await import('@goodboy/db');
    type Sets = Awaited<ReturnType<typeof listTurnFileSets>>;
    const setOf = ({ path, recordedAtMs }: { path: string; recordedAtMs: number }): Sets => [
      {
        runId: RUN,
        mountId: MOUNT,
        sessionId: SESSION,
        own: [{ path, status: 'added', additions: 1, deletions: 0 }],
        fromBase: [],
        isPartial: false,
        recordedAtMs,
      },
    ];
    let releaseOlder: (sets: Sets) => void = () => undefined;
    vi.mocked(listTurnFileSets)
      .mockImplementationOnce(
        () =>
          new Promise<Sets>((resolve) => {
            releaseOlder = resolve;
          }),
      )
      .mockResolvedValueOnce(setOf({ path: 'db/schema.ts', recordedAtMs: 2_000 }));
    const older = useAppStore.getState().loadTurnFiles({ sessionId: SESSION });
    await useAppStore.getState().loadTurnFiles({ sessionId: SESSION });
    releaseOlder(setOf({ path: 'old.ts', recordedAtMs: 1_000 }));
    await older;
    expect(useAppStore.getState().turnFiles[SESSION]).toEqual([
      { mountId: MOUNT, paths: ['db/schema.ts'], recordedAtMs: 2_000 },
    ]);
  });

  it('reports a failed read for that session with a Retry that reads again', async () => {
    const { listTurnFileSets } = await import('@goodboy/db');
    const reportError = vi.fn(async (_params: ReportErrorParams) => undefined);
    useAppStore.setState({ reportError });
    vi.mocked(listTurnFileSets).mockRejectedValueOnce(new Error('database is locked'));
    const isOk = await useAppStore.getState().refreshTurnFiles({ sessionId: SESSION });
    expect(isOk).toBe(false);
    expect(reportError).toHaveBeenCalledTimes(1);
    const reported = reportError.mock.calls[0]?.[0];
    expect(reported?.sessionId).toBe(SESSION);
    expect(reported?.coalesceKey).toBe(`turn-files:${SESSION}`);

    vi.mocked(listTurnFileSets).mockResolvedValueOnce([]);
    expect(await reported?.retry?.()).toBe(true);
    expect(useAppStore.getState().turnFiles[SESSION]).toEqual([]);
  });

  it('reports again when the Retry fails too', async () => {
    const { listTurnFileSets } = await import('@goodboy/db');
    const reportError = vi.fn(async (_params: ReportErrorParams) => undefined);
    useAppStore.setState({ reportError });
    vi.mocked(listTurnFileSets).mockRejectedValue(new Error('database is locked'));
    await useAppStore.getState().refreshTurnFiles({ sessionId: SESSION });
    expect(await reportError.mock.calls[0]?.[0].retry?.()).toBe(false);
    expect(reportError).toHaveBeenCalledTimes(2);
    vi.mocked(listTurnFileSets).mockReset();
  });
});
