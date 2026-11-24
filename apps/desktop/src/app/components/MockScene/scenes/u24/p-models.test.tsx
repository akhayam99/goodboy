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
import { runA11yCheck } from '../../../../../__tests__/a11y/utils';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U24_P_MODELS_SCENES } from './p-models';

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

const mount = async (name: string): Promise<Element> => {
  const Scene = U24_P_MODELS_SCENES[name];
  if (Scene === undefined) {
    throw new Error(`no scene ${name}`);
  }
  const { container } = render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
  expect(screen.queryByText('Something went wrong')).toBeNull();
  return container;
};

describe('the Models page scenes', () => {
  it('registers both scenes for the capture', () => {
    expect(Object.keys(U24_P_MODELS_SCENES).sort()).toEqual([
      'modelswilluse',
      'modelswilluse-cleared',
    ]);
    expect(MOCK_SCENES.modelswilluse).toBe(U24_P_MODELS_SCENES.modelswilluse);
  });

  it('modelswilluse shows the saved project settings and leaves the role pins to Every run', async () => {
    await mount('modelswilluse');

    expect(screen.getByText('Saved model settings from 1 folder no longer apply.')).toBeDefined();
    expect(screen.queryByText(/use a pin that can't run/)).toBeNull();
    expect(screen.queryByRole('button', { name: /^Back to Auto for/ })).toBeNull();
    expect(screen.queryByRole('img', { name: /^Pinned Opus 5\.5 is skipped/ })).toBeNull();
  });

  it('modelswilluse-cleared drops the notice', async () => {
    await mount('modelswilluse-cleared');

    expect(screen.queryByText(/no longer apply/)).toBeNull();
    expect(screen.getByRole('heading', { name: 'Background tasks' })).toBeDefined();
  });

  it.each(Object.keys(U24_P_MODELS_SCENES))(
    '%s has no accessibility violation once drawn',
    async (name) => {
      const container = await mount(name);
      vi.useRealTimers();

      const { violations } = await runA11yCheck(container);

      expect(violations.map((violation) => violation.id)).toEqual([]);
    },
  );
});
