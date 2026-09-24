// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { ToastProvider } from '../../app/components/Toast';
import { MOCK_SCENES } from '../../app/components/MockScene';
import { expectBaseline } from './baseline';
import { STORE_IMPORT_TIMEOUT_MS, importStore, resetStoryStore } from '../../store/storyHarness';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

describe('a11y, every mock scene', () => {
  it.each(Object.entries(MOCK_SCENES))('scene %s', async (key, Scene) => {
    const { container } = render(
      <ToastProvider>
        <Scene />
      </ToastProvider>,
    );
    await expectBaseline({ name: `scene ${key}`, container });
  });
});
