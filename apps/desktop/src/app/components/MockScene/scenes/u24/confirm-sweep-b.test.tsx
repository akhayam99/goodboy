// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { STORE_IMPORT_TIMEOUT_MS, importStore } from '../../../../../store/storyHarness';
import { MOCK_SCENES } from '../..';
import { U24_CONFIRM_SWEEP_B_SCENES } from './confirm-sweep-b';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
afterEach(cleanup);

const SCENE_IDS = [
  'confirm-artifact-delete',
  'confirm-folder-remove',
  'confirm-signout',
  'confirm-reset-app',
] as const;

const slotRects = (): ReadonlyArray<string> =>
  [...document.querySelectorAll('[data-slot]')].map((node) => {
    const rect = node.getBoundingClientRect();
    return `${node.getAttribute('data-slot')}:${rect.top}:${rect.height}`;
  });

describe('the confirm sweep b scenes', () => {
  it('registers the four scenes for the capture', () => {
    expect(Object.keys(U24_CONFIRM_SWEEP_B_SCENES)).toEqual([...SCENE_IDS]);
    for (const id of SCENE_IDS) {
      expect(MOCK_SCENES[id]).toBe(U24_CONFIRM_SWEEP_B_SCENES[id]);
    }
  });

  it('artifact delete asks in a portal popover and leaves the page untouched', () => {
    const Scene = U24_CONFIRM_SWEEP_B_SCENES['confirm-artifact-delete'];
    const { container } = render(<Scene />);
    const before = slotRects();
    const scrollHeight = document.documentElement.scrollHeight;

    fireEvent.click(
      screen.getByRole('button', { name: 'Delete Settlement replay plan permanently' }),
    );

    const dialog = screen.getByRole('dialog', {
      name: 'Delete "Settlement replay plan" for good?',
    });
    expect(dialog.closest('[data-dropdown-portal]')).not.toBeNull();
    expect(container.contains(dialog)).toBe(false);
    expect(slotRects()).toEqual(before);
    expect(document.documentElement.scrollHeight).toBe(scrollHeight);
  });

  it('artifact delete removes the row and moves focus to the next row', async () => {
    const Scene = U24_CONFIRM_SWEEP_B_SCENES['confirm-artifact-delete'];
    render(<Scene />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Delete Settlement replay plan permanently' }),
    );
    const dialog = screen.getByRole('dialog', {
      name: 'Delete "Settlement replay plan" for good?',
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete permanently' }));

    await waitFor(() => expect(screen.queryByText('Settlement replay plan')).toBeNull());
    await waitFor(() =>
      expect(document.activeElement?.closest('[data-artifact-row]')?.textContent).toContain(
        'Payout export report',
      ),
    );
  });

  it('folder remove opens a wide popover from its row and keeps the rows still', async () => {
    const Scene = U24_CONFIRM_SWEEP_B_SCENES['confirm-folder-remove'];
    render(<Scene />);
    const before = slotRects();

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

    const dialog = await screen.findByRole('dialog', {
      name: 'Remove anyway? 3 changed files will be lost.',
    });
    expect(dialog.closest('[data-dropdown-portal]')).not.toBeNull();
    expect(slotRects()).toEqual(before);

    fireEvent.keyDown(within(dialog).getByRole('button', { name: 'Cancel' }), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('sign out asks beside the Disconnect button and signs out on confirm', async () => {
    const Scene = U24_CONFIRM_SWEEP_B_SCENES['confirm-signout'];
    render(<Scene />);
    const before = slotRects();

    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
    const dialog = screen.getByRole('dialog', { name: 'Disconnect Claude?' });
    expect(slotRects()).toEqual(before);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Disconnect' }));

    await waitFor(() => expect(screen.getByText('Signed out')).toBeDefined());
  });

  it('reset app puts focus on Cancel and gives it back to the trigger on Escape', async () => {
    const Scene = U24_CONFIRM_SWEEP_B_SCENES['confirm-reset-app'];
    render(<Scene />);
    const trigger = screen.getByRole('button', { name: 'Delete all data' });

    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog', {
      name: 'Delete every workspace, session and rule?',
    });
    await waitFor(() =>
      expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Cancel' })),
    );
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });
});
