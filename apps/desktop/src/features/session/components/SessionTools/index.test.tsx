// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ExploreEntry } from '../../../explore/explore';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { DrawerHost } from '../../../../app/components/DrawerHost';
import { ToastProvider } from '../../../../shared/components/Toast';
import {
  SESSION_ID,
  seedActivityRunScene,
} from '../../../../app/components/MockScene/scenes/activityRunSeed';
import { SessionTools } from '.';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  seedActivityRunScene();
});

afterEach(() => {
  cleanup();
});

const renderCluster = () =>
  render(
    <ToastProvider>
      <SessionTools sessionId={SESSION_ID} />
      <DrawerHost />
    </ToastProvider>,
  );

const settle = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
};

const toggle = (name: 'ask' | 'terminal' | 'explore' | 'context' | 'scripts') =>
  screen.getByTestId(`pane-toggle-${name}`);

const drawerKind = () => useAppStore.getState().drawer?.kind ?? null;

const README: ExploreEntry = {
  name: 'README.md',
  relPath: 'README.md',
  isDir: false,
  sizeBytes: 120,
  modifiedAt: null,
};

describe('SessionTools', () => {
  it('stacks Ask, Terminal, Explore, Context and Scripts as icons in a vertical toolbar', () => {
    renderCluster();
    const toolbar = screen.getByRole('toolbar', { name: 'Session tools' });
    expect(toolbar.getAttribute('aria-orientation')).toBe('vertical');
    const buttons = within(toolbar).getAllByRole('button');
    expect(buttons.map((button) => button.getAttribute('aria-label')?.split(',')[0])).toEqual([
      'Ask',
      'Terminal',
      'Explore',
      'Context',
      'Scripts',
    ]);
    expect(buttons.every((button) => button.textContent === '')).toBe(true);
    expect(within(toolbar).queryByRole('button', { name: /^More/ })).toBeNull();
  });

  it('keeps one tab stop and moves it with the arrow keys, Home and End', () => {
    renderCluster();
    const toolbar = screen.getByRole('toolbar', { name: 'Session tools' });
    const buttons = within(toolbar).getAllByRole('button');
    expect(buttons.map((button) => button.tabIndex)).toEqual([0, -1, -1, -1, -1]);
    act(() => {
      buttons[0]?.focus();
    });
    fireEvent.keyDown(toolbar, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(buttons[1]);
    fireEvent.keyDown(toolbar, { key: 'End' });
    expect(document.activeElement).toBe(buttons[4]);
    fireEvent.keyDown(toolbar, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(buttons[0]);
    fireEvent.keyDown(toolbar, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(buttons[4]);
    expect(buttons.map((button) => button.tabIndex)).toEqual([-1, -1, -1, -1, 0]);
  });

  it('presses the icon of the open pane', async () => {
    renderCluster();
    fireEvent.click(toggle('scripts'));
    await settle();
    expect(drawerKind()).toBe('scripts');
    expect(toggle('scripts').getAttribute('aria-pressed')).toBe('true');
    expect(toggle('scripts').className).toContain('[&>svg:first-child]:text-info');
    expect(toggle('ask').getAttribute('aria-pressed')).toBe('false');
    expect(toggle('ask').className).not.toContain('[&>svg:first-child]:text-');
  });

  it('marks Context with a pulsing dot while the summary runs and a danger dot when it failed', async () => {
    const seed = (status: 'running' | 'error') =>
      act(() => {
        useAppStore.setState((state) => ({
          summarizerStatus: {
            ...state.summarizerStatus,
            [SESSION_ID]: {
              status,
              lastUpdate: null,
              error: null,
              lastUsage: null,
              lastAttempt: null,
            },
          },
        }));
      });
    renderCluster();

    seed('running');
    expect(screen.getByTestId('tool-signal').getAttribute('data-signal')).toBe('running');
    expect(toggle('context').getAttribute('aria-label')).toBe('Context, Updating context');

    seed('error');
    expect(screen.getByTestId('tool-signal').getAttribute('data-signal')).toBe('error');
    expect(toggle('context').getAttribute('aria-label')).toBe(
      "Context, Couldn't update the context. Open to retry.",
    );
    expect(toggle('ask').getAttribute('aria-label')).toBe('Ask');
  });

  it('opens one pane at a time: a second toggle replaces the first', async () => {
    renderCluster();

    fireEvent.click(toggle('ask'));
    await settle();
    expect(drawerKind()).toBe('ask');
    expect(toggle('ask').getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(toggle('explore'));
    await settle();
    expect(drawerKind()).toBe('explore');
    expect(toggle('ask').getAttribute('aria-pressed')).toBe('false');
    expect(toggle('explore').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('region', { name: 'Explore' })).toBeDefined();
  });

  it('closes the open pane when its toggle is pressed again', async () => {
    renderCluster();

    fireEvent.click(toggle('explore'));
    await settle();
    fireEvent.click(toggle('explore'));
    await settle();

    expect(drawerKind()).toBeNull();
  });

  it('opens Context and Scripts from their own rows', async () => {
    renderCluster();

    fireEvent.click(toggle('scripts'));
    await settle();
    expect(drawerKind()).toBe('scripts');
    expect(screen.getByRole('region', { name: 'Scripts' })).toBeDefined();

    fireEvent.click(toggle('context'));
    await settle();
    expect(drawerKind()).toBe('context');
    expect(toggle('context').getAttribute('aria-pressed')).toBe('true');
    expect(toggle('scripts').getAttribute('aria-pressed')).toBe('false');
  });

  it('keeps Explore lit on a file it opened and walks back to the files', async () => {
    renderCluster();
    act(() => {
      useAppStore.getState().openDrawer({
        kind: 'explore-file',
        sessionId: SESSION_ID,
        payload: { sessionDir: '/work/harborline/payments-api', entry: README, from: 'explore' },
      });
    });
    await settle();
    expect(toggle('explore').getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Back to files' }));
    await settle();

    expect(drawerKind()).toBe('explore');
  });

  it('walks a script output opened from Scripts back to the scripts', async () => {
    renderCluster();
    act(() => {
      useAppStore.getState().openDrawer({
        kind: 'scriptRun',
        sessionId: SESSION_ID,
        payload: { scriptKey: 'pnpm test', mountId: null, from: 'scripts' },
      });
    });
    await settle();

    fireEvent.click(screen.getByRole('button', { name: 'Back to scripts' }));
    await settle();

    expect(drawerKind()).toBe('scripts');
  });
});
