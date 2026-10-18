// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
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

  it('u26s-notifications-header-menu offers Mark all read and Delete all', async () => {
    mount({ id: 'u26s-notifications-header-menu' });

    const menu = await screen.findByRole('menu', { name: 'More notification actions' }, WAIT);

    expect(within(menu).getByRole('menuitem', { name: /Mark all read/ })).toBeDefined();
    expect(within(menu).getByRole('menuitem', { name: /Delete all/ })).toBeDefined();
  });

  it('u26s-notifications-row-menu opens the registry menu of a row', async () => {
    mount({ id: 'u26s-notifications-row-menu' });

    const menu = await screen.findByRole('menu', { name: /^Actions for "Session reached/ }, WAIT);

    expect(within(menu).getByRole('menuitem', { name: 'Copy text' })).toBeDefined();
    expect(within(menu).getByRole('menuitem', { name: 'Delete' })).toBeDefined();
  });
});
