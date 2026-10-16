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
import { PaneCluster } from '.';

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
      <PaneCluster sessionId={SESSION_ID} />
      <DrawerHost />
    </ToastProvider>,
  );

const settle = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
};

const toggle = (name: 'ask' | 'terminal' | 'explore') => screen.getByTestId(`pane-toggle-${name}`);

const drawerKind = () => useAppStore.getState().drawer?.kind ?? null;

const README: ExploreEntry = {
  name: 'README.md',
  relPath: 'README.md',
  isDir: false,
  sizeBytes: 120,
  modifiedAt: null,
};

describe('PaneCluster', () => {
  it('shows Ask, Terminal, Explore and the more menu in that order, as words', () => {
    renderCluster();

    const cluster = screen.getByRole('group', { name: 'Panes' });
    const words = within(cluster)
      .getAllByRole('button')
      .map((button) => button.textContent);
    expect(words.slice(0, 3)).toEqual(['Ask', 'Terminal', 'Explore']);
    expect(within(cluster).getByRole('button', { name: /^More panes/ })).toBeDefined();
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

  it('opens Context and Scripts from the more menu', async () => {
    renderCluster();

    fireEvent.click(screen.getByRole('button', { name: /^More panes/ }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /^Scripts/ }));
    await settle();
    expect(drawerKind()).toBe('scripts');
    expect(screen.getByRole('region', { name: 'Scripts' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: /^More panes/ }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /^Context/ }));
    await settle();
    expect(drawerKind()).toBe('context');
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
