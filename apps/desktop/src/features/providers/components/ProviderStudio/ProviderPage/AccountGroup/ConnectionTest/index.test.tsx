// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../../../../../../store/storyHarness';
import { ConnectionTest } from './index';

let store: StoryStore;
beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ log_provider_standing: null });
});
afterEach(cleanup);

it('disables the button while testing, then shows a failure and retries', async () => {
  const info = store.getState().providers.find((provider) => provider.id === 'cursor');
  if (info === undefined) {
    throw new Error('Missing Cursor');
  }
  let finish: (value: unknown) => void = () => undefined;
  stubStoryInvoke({
    provider_test_connection: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  const onReauth = vi.fn();
  render(
    <ConnectionTest info={info} onReauth={onReauth}>
      <span>Signed in</span>
    </ConnectionTest>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Test connection' }));
  expect(screen.getByRole('button', { name: 'Testing...' }).hasAttribute('disabled')).toBe(true);
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  await act(async () => {
    finish({ ok: false, millis: 50, detail: 'Not logged in\nPrivate diagnostic' });
  });
  expect(screen.getByText('Cursor did not accept the call: Not logged in.')).toBeDefined();
  expect(screen.queryByText(/Private diagnostic/)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Sign in again' }));
  expect(onReauth).toHaveBeenCalledOnce();
  stubStoryInvoke({
    provider_test_connection: { ok: true, millis: 800, detail: 'Models answered' },
  });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Test connection' }));
  });
  expect(screen.getByText('Cursor answered in 0.8 s.')).toBeDefined();
});

it('leaves the test button out for providers without an account call', () => {
  const info = store.getState().providers.find((provider) => provider.id === 'gemini');
  if (info === undefined) {
    throw new Error('Missing Gemini');
  }
  render(
    <ConnectionTest info={info} onReauth={vi.fn()}>
      <span>Signed in</span>
    </ConnectionTest>,
  );
  expect(screen.queryByRole('button', { name: 'Test connection' })).toBeNull();
  expect(screen.getByRole('button', { name: 'History' })).toBeDefined();
});
