// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { ToastProvider } from '../../app/components/Toast';
import { MOCK_SCENES } from '../../app/components/MockScene';
import { expectBaseline } from './baseline';
import { STORE_IMPORT_TIMEOUT_MS, importStore, resetStoryStore } from '../../store/storyHarness';

const SCENE_SETTLE_MS = 10_000;

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
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
    await expectBaseline({ name: `scene ${key}`, container });
  });
});
