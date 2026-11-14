// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke, sceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U39_P7_SCENES } from './p7-session-pages';

const SETTLE_MS = 2_000;

type SceneName = keyof typeof U39_P7_SCENES;

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  storySpies.tauriInvoke.mockImplementation((command, args) =>
    sceneInvoke({ command: String(command), args }),
  );
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  clearSceneInvoke();
});

const mount = async (name: SceneName): Promise<void> => {
  const Scene = U39_P7_SCENES[name];
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

const tabs = (): HTMLElement => {
  const lists = screen.getAllByRole('tablist', { name: 'Session pages' });
  return (
    lists.find((list) => list.querySelector('[aria-selected="true"]') !== null) ??
    lists[0] ??
    document.body
  );
};

const tabLabelsOf = (): ReadonlyArray<string> =>
  within(tabs())
    .getAllByRole('tab')
    .map((tab) => tab.textContent?.replace(/\d+$/, '') ?? '');

describe('the ux39 P7 session pages scenes', () => {
  it('registers every scene in the mock registry', () => {
    for (const name of Object.keys(U39_P7_SCENES)) {
      expect(MOCK_SCENES[name], name).toBeDefined();
    }
  });

  it('ux39-p7-open lists the pages as tabs with Questions counted and the actions in the title row', async () => {
    await mount('ux39-p7-open');

    expect(tabLabelsOf()).toEqual([
      'Overview',
      'Changes',
      'Runs',
      'Artifacts',
      'Questions',
      'Context',
    ]);
    expect(
      within(tabs())
        .getByRole('tab', { name: /^Questions/ })
        .querySelector('[data-tab-count]')?.textContent,
    ).toBe('1');
    expect(screen.getByRole('button', { name: 'Refresh session' }).tagName).toBe('BUTTON');
    expect(within(tabs()).queryByRole('button', { name: 'Refresh session' })).toBeNull();
  });

  it('ux39-p7-open-branchless draws the pages of a plain folder', async () => {
    await mount('ux39-p7-open-branchless');

    expect(within(tabs()).getByRole('tab', { name: /^Overview/ }).tagName).toBe('BUTTON');
    expect(within(tabs()).getByRole('tab', { name: /^Changes/ }).tagName).toBe('BUTTON');
  });

  it('ux39-p7-session-menu opens the session menu with five rows at most', async () => {
    await mount('ux39-p7-session-menu');

    const items = within(screen.getByRole('menu')).getAllByRole('menuitem');
    expect(items.length).toBeGreaterThan(0);
    expect(items.length).toBeLessThanOrEqual(5);
  });

  it('ux39-p7-runs-waiting counts the waiting run on the Runs tab', async () => {
    await mount('ux39-p7-runs-waiting');

    const runs = within(tabs()).getByRole('tab', { name: /^Runs/ });
    expect(runs.querySelector('[data-tab-count]')).not.toBeNull();
  });
});
