// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { spendFigures } from '../../../../features/budget/spendFigures';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { seedBoardScene } from './BoardScene';

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  vi.useRealTimers();
});

const todaySpendAt = (at: Date): number => {
  vi.useFakeTimers({ now: at, toFake: ['Date'] });
  seedBoardScene();
  const records = Object.values(store.getState().sessionTelemetry).flat();
  return spendFigures({ records, nowMs: Date.now(), sinceMs: null }).today.usd;
};

describe('the board scene spend', () => {
  it('has spend today at noon', () => {
    expect(todaySpendAt(new Date(2026, 9, 18, 12, 0, 0))).toBeGreaterThan(0);
  });

  it('has the same spend today ten seconds after midnight', () => {
    const noon = todaySpendAt(new Date(2026, 9, 18, 12, 0, 0));
    expect(todaySpendAt(new Date(2026, 9, 18, 0, 0, 10))).toBe(noon);
  });
});
