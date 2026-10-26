import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from './storyHarness';
import { driveStreamRuns } from '../test/driveStreamRuns';
import { turnEventBus } from '../test/turnEventBus';
import { clearPendingTurnEvents } from './slices/transcripts/buffer';
import { STREAM_BUDGETS } from './slices/transcripts/streamBudgets';

vi.mock('@tauri-apps/api/core', async () => (await import('./storyHarness')).tauriCoreModuleMock());
vi.mock('@tauri-apps/api/event', async () => ({
  listen: (await import('../test/turnEventBus')).turnEventBus.listen,
}));
vi.mock('../shared/lib/db', async () => (await import('./storyHarness')).dbLibModuleMock());
vi.mock('@goodboy/db', async () => (await import('./storyHarness')).dbModuleMock());

const TEXT_DELTAS = 400;

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  turnEventBus.reset();
  clearPendingTurnEvents();
  stubStoryInvoke({ turn_spawn: 'started', turn_release: null, turn_cancel: null });
  useAppStore.setState({ transcripts: {} });
});

afterEach(() => {
  turnEventBus.reset();
});

describe('the streaming hot path, performance', () => {
  it.each(STREAM_BUDGETS.concurrentRunCounts)(
    'dispatches and flushes an event of %i concurrent runs inside the budget',
    async (runCount) => {
      const result = await driveStreamRuns({
        runCount,
        textDeltas: TEXT_DELTAS,
        store: useAppStore,
      });

      const perEventDispatch = result.dispatchMs / result.eventsAppended;
      const perEventTotal = result.totalMs / result.eventsAppended;
      expect(perEventDispatch).toBeLessThan(STREAM_BUDGETS.dispatchMsPerEvent);
      expect(perEventTotal).toBeLessThan(STREAM_BUDGETS.totalMsPerEvent);
    },
  );
});
