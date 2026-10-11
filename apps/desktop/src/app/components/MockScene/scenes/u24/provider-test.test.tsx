// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { runA11yCheck } from '../../../../../__tests__/a11y/utils';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { U24_PROVIDER_TEST_SCENES } from './provider-test';

beforeAll(async () => {
  await importStore();
  await import('../../../../../features/settings/components/SettingsStudio');
}, STORE_IMPORT_TIMEOUT_MS);
beforeEach(async () => {
  await resetStoryStore();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});
afterEach(() => {
  vi.useRealTimers();
  cleanup();
  clearSceneInvoke();
  window.history.replaceState(null, '', '/');
});

type MountParams = { readonly id: string };
const mount = async ({ id }: MountParams) => {
  window.history.replaceState(null, '', `/?scene=${id}`);
  const Scene = U24_PROVIDER_TEST_SCENES[id];
  if (Scene === undefined) {
    throw new Error('Missing provider test scene');
  }
  const { container } = render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000);
  });
  expect(screen.queryByText('Something went wrong')).toBeNull();
  return container;
};

describe('provider test scenes', () => {
  it('shows the answered result', async () => {
    await mount({ id: 'providertest-ok' });
    expect(screen.getByText('Cursor answered in 0.8 s.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Test connection' })).toBeDefined();
  });
  it('shows refusal recovery', async () => {
    await mount({ id: 'providertest-refused' });
    expect(screen.getByText(/Cursor did not accept the call: Not logged in/)).toBeDefined();
    expect(screen.getAllByRole('button', { name: 'Sign in again' }).length).toBeGreaterThan(0);
  });
  it('opens the history next to its trigger', async () => {
    await mount({ id: 'providerhistory' });
    expect(screen.getByRole('region', { name: 'Cursor connection history' })).toBeDefined();
    expect(screen.getByText('Test connection passed')).toBeDefined();
    expect(screen.getByText('Probe timed out')).toBeDefined();
  });
  it.each(Object.keys(U24_PROVIDER_TEST_SCENES))(
    '%s has no accessibility violations',
    async (id) => {
      const container = await mount({ id });
      vi.useRealTimers();
      expect((await runA11yCheck(container)).violations).toEqual([]);
    },
  );
});
