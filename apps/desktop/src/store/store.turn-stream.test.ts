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

const TEXT_DELTAS = 120;

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

describe.each(STREAM_BUDGETS.concurrentRunCounts)(
  '%i concurrent runs stream a fixed script',
  (runCount) => {
    it('delivers every event to its own run and nothing to another', async () => {
      const result = await driveStreamRuns({
        runCount,
        textDeltas: TEXT_DELTAS,
        store: useAppStore,
      });

      const transcripts = useAppStore.getState().transcripts;
      const lengths = result.agentIds.map((agentId) => transcripts[agentId]?.length ?? 0);
      expect(new Set(lengths).size).toBe(1);
      expect(lengths[0]).toBeGreaterThan(TEXT_DELTAS);
      expect(result.eventsAppended).toBe(lengths.reduce((sum, length) => sum + length, 0));
      for (const [index, agentId] of result.agentIds.entries()) {
        const runIds = new Set(
          (transcripts[agentId] ?? []).map((event) => ('runId' in event ? event.runId : null)),
        );
        expect(runIds).toEqual(new Set([result.runIds[index]]));
      }
    });

    it('keeps listener calls and copied rows inside the budget', async () => {
      const result = await driveStreamRuns({
        runCount,
        textDeltas: TEXT_DELTAS,
        store: useAppStore,
      });

      const runLength = Math.round(result.eventsAppended / runCount);
      const callsBudget =
        STREAM_BUDGETS.listenerCallsPerEnvelope * runCount * result.envelopesPerRun;
      expect(result.listenerCalls).toBeLessThanOrEqual(callsBudget);
      expect(result.peakListeners).toBeLessThanOrEqual(STREAM_BUDGETS.listenersPerWindow);
      expect(result.copiedRows).toBeLessThanOrEqual(
        result.eventsAppended * STREAM_BUDGETS.copiedRowsPerEvent({ runLength }),
      );
    });
  },
);
