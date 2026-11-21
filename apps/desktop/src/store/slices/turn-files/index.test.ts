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
});
