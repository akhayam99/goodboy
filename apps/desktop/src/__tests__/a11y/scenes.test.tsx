// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { ToastProvider } from '../../shared/components/Toast';
import { MOCK_SCENES } from '../../app/components/MockScene';
import { expectBaseline } from './baseline';
import { STORE_IMPORT_TIMEOUT_MS, importStore, resetStoryStore } from '../../store/storyHarness';

const SCENE_SETTLE_MS = 10_000;
const INTENTIONAL_CRASH = 'fetch failed: Authorization';
const CRASH_SCENES: ReadonlySet<string> = new Set(['crash-report']);

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

let renderLoops: Array<string> = [];

beforeEach(async () => {
  await resetStoryStore();
  renderLoops = [];
  const logError = console.error;
  vi.spyOn(console, 'error').mockImplementation((...args: ReadonlyArray<unknown>) => {
    const line = args.map(String).join(' ');
    if (line.includes('Maximum update depth')) {
      renderLoops.push(line);
    }
    if (line.includes(INTENTIONAL_CRASH)) {
      return;
    }
    logError(...args);
  });
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  vi.restoreAllMocks();
});

describe('a11y, every mock scene', () => {
  it.each(Object.entries(MOCK_SCENES))('scene %s', async (key, Scene) => {
    const { container } = render(
      <ToastProvider>
        <Scene />
      </ToastProvider>,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SCENE_SETTLE_MS);
    });
    vi.useRealTimers();
    expect(document.body.textContent?.trim() ?? '').not.toBe('');
    if (!CRASH_SCENES.has(key)) {
      expect(document.body.textContent ?? '').not.toContain('Something went wrong');
    }
    expect(renderLoops).toEqual([]);
    await expectBaseline({ name: `scene ${key}`, container });
  });
});
