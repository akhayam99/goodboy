// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { SETTING_REPO_CHECK_MINUTES } from '../../../../../../features/settings/settings';
import { ToastProvider } from '../../../../../../shared/components/Toast';
import { getAppliedTheme } from '../../../../../../shared/lib/theme';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../../..';
import { U26S_NOTIFICATIONS_SCENES } from './NotificationsScene';

const WAIT = { timeout: 15_000 };

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.spyOn(document, 'hasFocus').mockImplementation(() => true);
});

afterEach(() => {
  cleanup();
  clearSceneInvoke();
  vi.restoreAllMocks();
  window.history.replaceState(null, '', '/');
});

type SceneId = keyof typeof U26S_NOTIFICATIONS_SCENES;

const mount = ({ id }: { readonly id: SceneId }): void => {
  const Scene = U26S_NOTIFICATIONS_SCENES[id];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('the secondary Notifications scenes', () => {
  it('registers every scene for the capture', () => {
    expect(Object.keys(U26S_NOTIFICATIONS_SCENES).sort()).toEqual([
      'u26s-notifications-header-menu',
      'u26s-notifications-row-menu',
      'u26s-notifications-rows',
    ]);
    expect(MOCK_SCENES['u26s-notifications-rows']).toBe(
      U26S_NOTIFICATIONS_SCENES['u26s-notifications-rows'],
    );
  });

  it('u26s-notifications-rows boots without a repo check read, so no error row reaches the list', async () => {
    mount({ id: 'u26s-notifications-rows' });

    await screen.findAllByText(/Session reached/, undefined, WAIT);

    const state = (await importStore()).getState();
    expect(state.settings[SETTING_REPO_CHECK_MINUTES]).toBe('0');
    expect(state.notifications.filter((row) => /how often to check/.test(row.title))).toEqual([]);
  });

  it('u26s-notifications-rows draws each severity on the quiet node with the age in the time column', async () => {
    mount({ id: 'u26s-notifications-rows' });

    await screen.findAllByText(/Session reached/, undefined, WAIT);

    const nodeOf = ({ title }: { readonly title: string }): HTMLElement => {
      const row = screen.getAllByText(title)[0]?.closest<HTMLElement>('[data-notification-key]');
      const node = row?.querySelector<HTMLElement>('[data-node-look]');
      if (node == null) {
        throw new Error(`the row "${title}" has no node`);
      }
      return node;
    };
    const expected = [
      { title: 'Handoff degraded', state: 'failed', label: 'Error' },
      { title: 'Session reached 80% of its limit', state: 'alert', label: 'Warning' },
      { title: 'Pull request opened', state: 'done', label: 'Done' },
      { title: '1 session folder left on disk', state: 'marker', label: 'Info' },
    ] as const;
    for (const { title, state, label } of expected) {
      const node = nodeOf({ title });
      expect(node.getAttribute('data-node-look')).toBe('quiet');
      expect(node.getAttribute('data-node-state')).toBe(state);
      expect(node.getAttribute('aria-label')).toBe(label);
    }
    const ages = [...document.querySelectorAll('[data-notification-key] time')];
    expect(ages.length).toBeGreaterThan(0);
    for (const age of ages) {
      expect(age.closest('[data-meta-column="time"]')).not.toBeNull();
    }
  });

  it('notifications-light draws the rows on the quiet node in the light theme', async () => {
    const Scene = MOCK_SCENES['notifications-light'];
    if (Scene === undefined) {
      throw new Error('notifications-light is not registered');
    }
    render(
      <ToastProvider>
        <Scene />
      </ToastProvider>,
    );

    const [title] = await screen.findAllByText('Handoff degraded', undefined, WAIT);
    const node = title?.closest('[data-notification-key]')?.querySelector('[data-node-look]');

    expect(getAppliedTheme()).toBe('light');
    expect(node?.getAttribute('data-node-look')).toBe('quiet');
    expect(node?.getAttribute('data-node-state')).toBe('failed');
  });

  it('u26s-notifications-header-menu offers Mark all as read and Delete all', async () => {
    mount({ id: 'u26s-notifications-header-menu' });

    const menu = await screen.findByRole('menu', { name: 'More notification actions' }, WAIT);

    expect(within(menu).getByRole('menuitem', { name: /Mark all as read/ })).toBeDefined();
    expect(within(menu).getByRole('menuitem', { name: /Delete all/ })).toBeDefined();
  });

  it('u26s-notifications-row-menu opens the registry menu of a row', async () => {
    mount({ id: 'u26s-notifications-row-menu' });

    const menu = await screen.findByRole('menu', { name: /^Actions for "Session reached/ }, WAIT);

    expect(within(menu).getByRole('menuitem', { name: 'Copy text' })).toBeDefined();
    expect(within(menu).getByRole('menuitem', { name: 'Delete' })).toBeDefined();
  });
});
