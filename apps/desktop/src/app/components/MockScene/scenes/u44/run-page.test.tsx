// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
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
  storySpies,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke, sceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U44_RUN_PAGE_SCENES } from './run-page';

const SETTLE_MS = 2_000;

type SceneName = keyof typeof U44_RUN_PAGE_SCENES;

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  storySpies.tauriInvoke.mockImplementation((command, args) => {
    if (typeof command !== 'string') {
      throw new Error('The scene command must be a string.');
    }
    return sceneInvoke({ command, args });
  });
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  clearSceneInvoke();
});

const mount = async (name: SceneName): Promise<void> => {
  const Scene = U44_RUN_PAGE_SCENES[name];
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

const kindLine = (): string => document.querySelector('[data-run-kind-line]')?.textContent ?? '';

describe('the u44 run page scenes', () => {
  it('registers every scene in the mock registry', () => {
    for (const name of Object.keys(U44_RUN_PAGE_SCENES)) {
      expect(MOCK_SCENES[name], name).toBeDefined();
    }
  });

  it.each(['u44-run-page', 'u44-run-page-light'] as const)(
    '%s heads the run with its Lead and plan, under the Runs crumb',
    async (name) => {
      await mount(name);

      expect(kindLine()).toBe('Lead · plan Fix flaky tests');
      screen.getByRole('button', { name: 'Runs' });
      screen.getByRole('button', { name: 'Stop run' });
      screen.getByPlaceholderText('Message Lead');
    },
  );

  it.each(['u44-run-page-ask', 'u44-run-page-ask-light'] as const)(
    '%s holds the push for an answer, with the row it follows',
    async (name) => {
      await mount(name);

      expect(kindLine()).toBe('Lead · plan Fix flaky tests');
      expect(screen.getAllByRole('button', { name: 'Push' }).length).toBeGreaterThan(0);
      expect(screen.getAllByRole('button', { name: "Don't push" }).length).toBeGreaterThan(0);
      expect(screen.queryByText("Couldn't read the permission")).toBeNull();
    },
  );
});
