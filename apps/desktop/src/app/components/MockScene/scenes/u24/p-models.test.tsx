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

  it('modelswilluse shows the project that wins, the skipped pins and the page line', async () => {
    await mount('modelswilluse');

    expect(screen.getByText('1 project has its own model settings')).toBeDefined();
    expect(
      screen.getByText(
        'It wins over this page when you work in it: orchestrator Sonnet 5, summaries Sonnet 4.5 and 6 roles in payments-api.',
      ),
    ).toBeDefined();
    expect(
      screen.getByText(
        'With Codex as the only provider, 7 of 11 agents use a pin that cannot run. Auto picks apply.',
      ),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Back to Auto for those 7' })).toBeDefined();
    expect(screen.getAllByText(/^Pinned Opus 5\.5 is skipped: Claude is Off\./).length).toBe(7);
  });

  it('modelswilluse-cleared drops the notice and keeps the rows as they were', async () => {
    await mount('modelswilluse-cleared');

    expect(screen.queryByText(/has its own model settings/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Back to Auto for those 7' })).toBeDefined();
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
