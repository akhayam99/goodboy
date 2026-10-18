// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).sqliteDbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  injectDbFault,
  openStorySqlite,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { PinPortPopover } from './PinPortPopover';

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  await openStorySqlite();
});

afterEach(() => {
  cleanup();
});

const openPopover = (): HTMLElement => {
  fireEvent.click(screen.getByRole('button', { name: 'Pin a port' }));
  return screen.getByRole('dialog', { name: 'Pin a port' });
};

describe('pin a port popover', () => {
  it('keeps the popover open with the draft when updating an existing pin fails', async () => {
    await store.getState().pinPort({ port: 3000, description: 'Billing' });
    render(<PinPortPopover />);
    const dialog = openPopover();
    fireEvent.change(within(dialog).getByLabelText('Port'), { target: { value: '3000' } });
    fireEvent.change(within(dialog).getByLabelText('Description'), {
      target: { value: 'Billing v2' },
    });
    injectDbFault({ match: /INSERT INTO settings/, message: 'disk full' });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Pin' }));

    await waitFor(() =>
      expect(within(dialog).getByRole('alert').textContent).toBe(
        "Couldn't pin the port. Try again.",
      ),
    );
    expect(screen.getByRole('dialog', { name: 'Pin a port' })).toBe(dialog);
    const draft = within(dialog).getByLabelText('Description');
    expect(draft instanceof HTMLInputElement ? draft.value : null).toBe('Billing v2');
    expect(store.getState().monitorPinned).toEqual([{ port: 3000, description: 'Billing' }]);
  });

  it('closes once the pin was saved', async () => {
    render(<PinPortPopover />);
    const dialog = openPopover();
    fireEvent.change(within(dialog).getByLabelText('Port'), { target: { value: '4000' } });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Pin' }));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Pin a port' })).toBeNull());
    expect(store.getState().monitorPinned).toEqual([{ port: 4000, description: '' }]);
  });
});
