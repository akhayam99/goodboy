// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U24_AUTO_SETTINGS_SCENES } from './auto-settings';

const SETTLE_MS = 2_000;

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
});

const mount = async (name: string): Promise<void> => {
  const Scene = U24_AUTO_SETTINGS_SCENES[name];
  if (Scene === undefined) {
    throw new Error(`no scene ${name}`);
  }
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
  expect(screen.queryByText('Something went wrong')).toBeNull();
};

describe('the Auto settings scenes', () => {
  it('registers every scene for the capture', () => {
    expect(Object.keys(U24_AUTO_SETTINGS_SCENES).sort()).toEqual([
      'auto-settings-experiment-off',
      'auto-settings-experiment-off-running',
      'auto-settings-experiment-on',
    ]);
    for (const [id, Scene] of Object.entries(U24_AUTO_SETTINGS_SCENES)) {
      expect(MOCK_SCENES[id]).toBe(Scene);
    }
  });

  it('auto-settings-experiment-off draws the band with the switch off', async () => {
    await mount('auto-settings-experiment-off');

    expect(screen.getByRole('heading', { name: 'Experiments' })).toBeDefined();
    expect(screen.getByText('Experimental')).toBeDefined();
    expect(screen.getByRole('switch', { name: 'Auto agent' }).getAttribute('aria-checked')).toBe(
      'false',
    );
  });

  it('auto-settings-experiment-on keeps the row and turns the switch on', async () => {
    await mount('auto-settings-experiment-on');

    expect(screen.getByText('Experimental')).toBeDefined();
    expect(screen.getByRole('switch', { name: 'Auto agent' }).getAttribute('aria-checked')).toBe(
      'true',
    );
  });

  it('auto-settings-experiment-off-running says 2 Auto agents keep going under the help', async () => {
    await mount('auto-settings-experiment-off-running');

    expect(screen.getByText('2 Auto agents are still running. They keep going.')).toBeDefined();
    expect(screen.getByRole('switch', { name: 'Auto agent' }).getAttribute('aria-checked')).toBe(
      'false',
    );
  });
});
