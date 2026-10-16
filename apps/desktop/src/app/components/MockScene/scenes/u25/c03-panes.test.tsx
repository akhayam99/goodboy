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

const cluster = (): HTMLElement => screen.getAllByRole('group', { name: 'Panes' })[0]!;

const pressed = (): ReadonlyArray<string> =>
  within(cluster())
    .getAllByRole('button')
    .filter((button) => button.getAttribute('aria-pressed') === 'true')
    .map((button) => button.textContent ?? '');

describe('c03 pane cluster scenes', () => {
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

  it('opens Ask beside the overview', async () => {
    await mount('c03-panes-ask');
    expect(useAppStore.getState().drawer?.kind).toBe('ask');
    expect(pressed()).toEqual(['Ask']);
  });

  it('opens the terminal on the worktree this session last used, with the scope picker', async () => {
    await mount('c03-panes-terminal');
    expect(useAppStore.getState().drawer?.kind).toBe('terminal');
    expect(pressed()).toEqual(['Terminal']);
    expect(screen.getByRole('combobox', { name: 'Terminal folder' }).textContent).toBe(
      'hl/fix-webhook-idempotency',
    );
  });

  it('opens Explore and a file from it with the way back', async () => {
    await mount('c03-panes-explore');
    expect(screen.getByRole('region', { name: 'Explore' })).toBeDefined();
    cleanup();
    await resetStoryStore();
    await mount('c03-panes-explore-file');
    expect(screen.getByRole('button', { name: 'Back to files' })).toBeDefined();
    expect(pressed()).toEqual(['Explore']);
  });

  it('opens Scripts and a script output with the way back', async () => {
    await mount('c03-panes-scripts');
    expect(screen.getByRole('region', { name: 'Scripts' })).toBeDefined();
    cleanup();
    await resetStoryStore();
    await mount('c03-panes-script-output');
    expect(screen.getByRole('button', { name: 'Back to scripts' })).toBeDefined();
  });

  it('opens Context and shows the more menu with its signal', async () => {
    await mount('c03-panes-context');
    expect(useAppStore.getState().drawer?.kind).toBe('context');
    cleanup();
    await resetStoryStore();
    await mount('c03-panes-more');
    expect(screen.getByRole('menuitem', { name: /^Context/ })).toBeDefined();
    expect(screen.getByRole('menuitem', { name: /^Scripts/ })).toBeDefined();
  });
});
