// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { MOCK_SCENES } from '../..';
import { U24_P_LISTS_SCENES } from './p-lists';

const WAIT = { timeout: 15_000 };

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

const mount = (name: keyof typeof U24_P_LISTS_SCENES): void => {
  const Scene = U24_P_LISTS_SCENES[name];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('the list scenes', () => {
  it('registers every scene for the capture', () => {
    expect(Object.keys(U24_P_LISTS_SCENES).sort()).toEqual([
      'activity-mark-seen',
      'notifications-delete-all',
      'tasks-cursor',
    ]);
    expect(MOCK_SCENES['tasks-cursor']).toBe(U24_P_LISTS_SCENES['tasks-cursor']);
  });

  it('notifications-delete-all arms the popover beside the button', async () => {
    mount('notifications-delete-all');

    const dialog = await screen.findByRole(
      'dialog',
      { name: /^Delete \d+ notifications\?$/ },
      WAIT,
    );
    expect(dialog.closest('[data-dropdown-portal]')).not.toBeNull();
    expect(dialog.closest('[data-slot="pane-title-row"]')).toBeNull();
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeDefined();
  });

  it('activity-mark-seen shows Mark all seen as a button, with no menu', async () => {
    mount('activity-mark-seen');

    const activity = await screen.findByRole('region', { name: 'Activity' }, WAIT);
    await within(activity).findByRole('button', { name: 'Mark all seen' }, WAIT);
    expect(within(activity).getByRole('button', { name: 'Mark all seen' })).toBeDefined();
    expect(within(activity).queryByRole('button', { name: 'Activity actions' })).toBeNull();
  });

  it('tasks-cursor shows a quiet cursor on the first row and no drawer', async () => {
    mount('tasks-cursor');

    await screen.findByRole('listbox', { name: 'Task items' }, WAIT);
    const cursors = document.querySelectorAll('[data-inbox-key][data-cursor]');
    expect(cursors).toHaveLength(1);
    expect(document.querySelectorAll('[data-selected="true"]')).toHaveLength(0);
    expect(screen.queryByText(/Seen on 14 orders/)).toBeNull();
  });
});
