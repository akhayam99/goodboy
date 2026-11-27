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
  type StoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke, sceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U39_P10_SCENES } from './p10-right-dock';

const SETTLE_MS = 2_000;

type SceneName = keyof typeof U39_P10_SCENES;

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
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
  const Scene = U39_P10_SCENES[name];
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

const rail = (): HTMLElement => screen.getByRole('toolbar', { name: 'Tools' });

const railTools = (): ReadonlyArray<string> =>
  within(rail())
    .getAllByRole('button')
    .map((button) => button.getAttribute('data-testid') ?? '');

describe('the ux39 right dock scenes', () => {
  it('registers every scene in the mock registry', () => {
    for (const name of Object.keys(U39_P10_SCENES)) {
      expect(MOCK_SCENES[name], name).toBeDefined();
    }
  });

  it.each(['ux39-p10-board', 'ux39-p10-tasks'] as const)(
    '%s keeps the five tools on the right rail',
    async (name) => {
      await mount(name);

      expect(railTools()).toEqual([
        'pane-toggle-terminal',
        'pane-toggle-browser',
        'pane-toggle-scripts',
        'pane-toggle-ask',
        'pane-toggle-monitoring',
      ]);
    },
  );

  it('ux39-p10-tasks keeps the rail still while the page fades in or out', async () => {
    await mount('ux39-p10-tasks');

    expect(document.querySelector('[data-studio="inbox"]')?.contains(rail())).toBe(true);
    expect(document.querySelector('[data-studio-motion]')).not.toBeNull();
    expect(rail().closest('[data-studio-motion]')).toBeNull();
  });

  it('ux39-p10-session holds the five tools on the rail', async () => {
    await mount('ux39-p10-session');

    expect(railTools()).toEqual([
      'pane-toggle-terminal',
      'pane-toggle-browser',
      'pane-toggle-scripts',
      'pane-toggle-ask',
      'pane-toggle-monitoring',
    ]);
  });

  it('ux39-p11-terminal-board draws Browser beside Terminal, both pressed, the rail last on the edge', async () => {
    await mount('ux39-p11-terminal-board');

    await act(async () => {
      within(rail()).getByTestId('pane-toggle-browser').click();
      await vi.advanceTimersByTimeAsync(SETTLE_MS);
    });

    const panes = Array.from(document.querySelectorAll('[data-dock-pane]')).map((pane) =>
      pane.getAttribute('data-dock-pane'),
    );
    expect(panes).toEqual(['terminal', 'browser']);
    expect(within(rail()).getByTestId('pane-toggle-terminal').getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(within(rail()).getByTestId('pane-toggle-browser').getAttribute('aria-pressed')).toBe(
      'true',
    );
    const box = document.querySelector('[data-container="drawer"]');
    expect(box?.lastElementChild?.contains(rail())).toBe(true);

    await act(async () => {
      within(rail()).getByTestId('pane-toggle-terminal').click();
      await vi.advanceTimersByTimeAsync(SETTLE_MS);
    });

    expect(
      Array.from(document.querySelectorAll('[data-dock-pane]')).map((pane) =>
        pane.getAttribute('data-dock-pane'),
      ),
    ).toEqual(['browser']);
  });

  it.each(['ux39-p11-terminal-board', 'ux39-p12-tasks-terminal'] as const)(
    '%s docks Terminal with no session and presses its button',
    async (name) => {
      await mount(name);

      expect(useAppStore.getState().drawer).toMatchObject({ kind: 'terminal', sessionId: null });
      vi.useRealTimers();
      await screen.findByRole('region', { name: 'Terminal' }, { timeout: 5_000 });
      expect(screen.queryByText("Couldn't open this terminal")).toBeNull();
      expect(within(rail()).getByTestId('pane-toggle-terminal').getAttribute('aria-pressed')).toBe(
        'true',
      );
    },
  );

  it('ux39-p11-terminal-page selects Terminal while its page is open', async () => {
    await mount('ux39-p11-terminal-page');

    expect(useAppStore.getState().appStudio?.kind).toBe('terminal');
    expect(within(rail()).getByTestId('pane-toggle-terminal').getAttribute('aria-current')).toBe(
      'page',
    );
  });

  it('ux39-p11-terminal-page docks a terminal from the empty page like Browser does', async () => {
    await mount('ux39-p11-terminal-page');

    await act(async () => {
      screen.getByRole('button', { name: 'Dock' }).click();
      await vi.advanceTimersByTimeAsync(SETTLE_MS);
    });

    expect(useAppStore.getState().appStudio).toBeNull();
    expect(useAppStore.getState().drawer?.kind).toBe('terminal');
  });

  it('ux39-p11-browser-session docks Browser on the session', async () => {
    await mount('ux39-p11-browser-session');

    expect(useAppStore.getState().drawer?.kind).toBe('browser');
    expect(within(rail()).getByTestId('pane-toggle-browser').getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('ux39-p4-column-folded shows the workspace, New, the seven places, Settings, Report and the mark, no tool, on the places rail', async () => {
    await mount('ux39-p4-column-folded');

    const places = Array.from(
      screen.getByRole('navigation', { name: 'Places' }).querySelectorAll('[data-shell-rail-item]'),
    ).map((item) => item.getAttribute('data-shell-rail-item'));
    expect(places).toEqual([
      'workspace',
      'new',
      'home',
      'board',
      'inbox',
      'workflows',
      'chat',
      'connections',
      'impact',
      'settings',
      'report',
      'signature',
    ]);
  });
});
