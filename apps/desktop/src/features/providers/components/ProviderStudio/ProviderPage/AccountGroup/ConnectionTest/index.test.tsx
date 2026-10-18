// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import {
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../../../../../../store/storyHarness';
import { canTestConnection } from './canTestConnection';
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

const infoOf = ({ id }: { readonly id: 'cursor' | 'gemini' }) => {
  const info = store.getState().providers.find((provider) => provider.id === id);
  if (info === undefined) {
    throw new Error(`Missing ${id}`);
  }
  return info;
};

it('holds no button of its own, only the row and the result of the last test', () => {
  render(
    <ConnectionTest info={infoOf({ id: 'cursor' })}>
      <span>Signed in</span>
    </ConnectionTest>,
  );

  expect(screen.getByText('Signed in')).toBeDefined();
  expect(screen.queryByRole('button')).toBeNull();
});

it('shows a failure with the first line only, then the answer time after a good test', async () => {
  const info = infoOf({ id: 'cursor' });
  render(
    <ConnectionTest info={info}>
      <span>Signed in</span>
    </ConnectionTest>,
  );
  stubStoryInvoke({
    provider_test_connection: {
      ok: false,
      millis: 50,
      detail: 'Not logged in\nPrivate diagnostic',
    },
  });
  await act(async () => {
    await store.getState().testProviderConnection({ providerId: 'cursor' });
  });
  expect(screen.getByText('Cursor did not accept the call: Not logged in.')).toBeDefined();
  expect(screen.queryByText(/Private diagnostic/)).toBeNull();
  expect(screen.queryByRole('button')).toBeNull();

  stubStoryInvoke({
    provider_test_connection: { ok: true, millis: 800, detail: 'Models answered' },
  });
  await act(async () => {
    await store.getState().testProviderConnection({ providerId: 'cursor' });
  });
  expect(screen.getByText('Cursor answered in 0.8 s.')).toBeDefined();
});

it('knows which providers have an account call to test', () => {
  expect(canTestConnection({ providerId: 'anthropic' })).toBe(true);
  expect(canTestConnection({ providerId: 'codex' })).toBe(true);
  expect(canTestConnection({ providerId: 'cursor' })).toBe(true);
  expect(canTestConnection({ providerId: 'gemini' })).toBe(false);
});

it('shows no result line for a provider without an account call', () => {
  render(
    <ConnectionTest info={infoOf({ id: 'gemini' })}>
      <span>Signed in</span>
    </ConnectionTest>,
  );

  expect(screen.queryByRole('status')).toBeNull();
});
