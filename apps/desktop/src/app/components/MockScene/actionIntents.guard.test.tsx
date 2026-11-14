// @vitest-environment happy-dom
const silentBridge = vi.hoisted(() => {
  const bridge = { invoke: () => new Promise<never>(() => undefined) };
  return () => bridge;
});
vi.mock('@tauri-apps/api/core', silentBridge);
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../../../shared/components/Toast';
import { STORE_IMPORT_TIMEOUT_MS, importStore, resetStoryStore } from '../../../store/storyHarness';
import { MOCK_SCENES } from './registry';

const SCENE_IDS = [
  'action-intents',
  'board-states',
  'branch-push',
  'u26-central-branches-dark',
  'u26-rebase-all-idle-dark',
  'u27-next-list-after-dark',
] as const;

const FILLED =
  'button[data-variant="primary"]:not([data-intent="caution"]):not([data-intent="destructive"])';
const TONED_FILLED =
  'button[data-variant="primary"][data-intent="caution"], button[data-variant="primary"][data-intent="destructive"]';
const ROWS = '[data-action-card], header';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
beforeEach(async () => {
  await resetStoryStore();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('action intents in the scenes', () => {
  it.each(SCENE_IDS)('%s has at most one filled button per row and header', async (id) => {
    const Scene = MOCK_SCENES[id];
    if (Scene === undefined) {
      throw new Error(`Unknown scene ${id}`);
    }
    render(
      <ToastProvider>
        <Scene />
      </ToastProvider>,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    for (const row of document.querySelectorAll(ROWS)) {
      expect(row.querySelectorAll(FILLED).length).toBeLessThanOrEqual(1);
    }
    if (id !== 'action-intents') {
      expect(document.querySelectorAll(TONED_FILLED).length).toBe(0);
    }
  });
});
