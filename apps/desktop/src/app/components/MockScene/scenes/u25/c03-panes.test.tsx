// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { SESSION_ID } from '../activityRunSeed';
import { U25_C03_PANE_SCENES } from './c03-panes';

const SETTLE_MS = 2_000;

type SceneName = keyof typeof U25_C03_PANE_SCENES;

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
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

const mount = async (name: SceneName): Promise<void> => {
  const Scene = U25_C03_PANE_SCENES[name];
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

const cluster = (): HTMLElement => screen.getByRole('toolbar', { name: 'Tools' });

const pressed = (): ReadonlyArray<string> =>
  within(cluster())
    .getAllByRole('button')
    .filter((button) => button.getAttribute('aria-pressed') === 'true')
    .map((button) => button.getAttribute('aria-label') ?? button.textContent ?? '');

describe('c03 session tools scenes', () => {
  it('registers every scene with the mock scene registry', () => {
    for (const name of Object.keys(U25_C03_PANE_SCENES)) {
      expect(MOCK_SCENES[name]).toBeDefined();
    }
  });

  it('shows the cluster at rest with nothing open', async () => {
    await mount('c03-panes-closed');
    expect(useAppStore.getState().drawer).toBeNull();
    expect(pressed()).toEqual([]);
  });

  it('opens Ask in the Context tab', async () => {
    await mount('c03-panes-ask');
    expect(useAppStore.getState().drawer).toBeNull();
    expect(useAppStore.getState().activeLens[SESSION_ID]).toBe('context');
    screen.getByRole('region', { name: 'Ask' });
    expect(pressed()).toEqual([]);
  });

  it('opens the terminal on the worktree this session last used, with the scope picker', async () => {
    await mount('c03-panes-terminal');
    expect(useAppStore.getState().drawer?.kind).toBe('terminal');
    expect(pressed()).toEqual(['Terminal, 2 running']);
    expect(screen.getByRole('combobox', { name: 'Terminal folder' }).textContent).toBe(
      'payments-api · hl/fix-duplicate-credit',
    );
  });

  it('opens Explore and a file from it with the way back', async () => {
    await mount('c03-panes-explore');
    expect(screen.getByRole('region', { name: 'Explore' })).toBeDefined();
    cleanup();
    await resetStoryStore();
    await mount('c03-panes-explore-file');
    expect(screen.getByRole('button', { name: 'Back to Explore' })).toBeDefined();
    expect(pressed()).toEqual(['Explore']);
    expect(document.querySelector('[data-column-layer="nav"]')).not.toBeNull();
  });

  it('opens Scripts and a script output with the way back', async () => {
    await mount('c03-panes-scripts');
    expect(screen.getByRole('region', { name: 'Scripts' })).toBeDefined();
    cleanup();
    await resetStoryStore();
    await mount('c03-panes-script-output');
    expect(screen.getByRole('button', { name: 'Back to scripts' })).toBeDefined();
  });

  it('opens Context as a tab', async () => {
    await mount('c03-panes-context');
    expect(useAppStore.getState().drawer).toBeNull();
    expect(useAppStore.getState().activeLens[SESSION_ID]).toBe('context');
    screen.getByRole('region', { name: 'Context' });
    expect(pressed()).toEqual([]);
  });

  it('keeps the tools in a column right of the content, not in the page tabs, and no page header holds a pane toggle', async () => {
    await mount('c03-panes-closed');
    const tabs = screen.getByRole('tablist', { name: 'Session pages' });
    expect(within(tabs).queryByRole('toolbar', { name: 'Tools' })).toBeNull();
    const frame = tabs.closest('[data-session-frame]');
    const tools = screen.getByRole('toolbar', { name: 'Tools' });
    expect(frame?.contains(tools)).toBe(false);
    expect(tools.closest('[data-drawer-main]')).toBe(frame?.closest('[data-drawer-main]'));
    const headers = [...document.querySelectorAll('[data-slot="pane-title-row"]')];
    expect(headers.length).toBeGreaterThan(0);
    expect(
      headers.filter((header) => header.querySelector('[data-testid^="pane-toggle-"]')),
    ).toEqual([]);
  });

  it('keeps the tool icons with the open one pressed', async () => {
    await mount('c03-panes-explore');
    const icons = within(cluster()).getAllByRole('button');
    expect(icons.map((icon) => icon.getAttribute('aria-label')?.split(',')[0])).toEqual([
      'Explore',
      'Agents',
      'Scripts',
      'Terminal',
      'Browser',
    ]);
    expect(icons.map((icon) => icon.getAttribute('aria-pressed'))).toEqual([
      'true',
      'false',
      'false',
      'false',
      'false',
    ]);
  });

  it.each([
    ['c03-panes-explore', 'Explore'],
    ['c03-panes-scripts', 'Scripts'],
  ] as const)('%s opens its pane, never the closed layout', async (name, label) => {
    await mount(name);
    expect(useAppStore.getState().drawer).not.toBeNull();
    expect(pressed()).toEqual([label]);
  });
});
