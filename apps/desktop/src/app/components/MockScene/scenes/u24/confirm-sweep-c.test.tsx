// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { STORE_IMPORT_TIMEOUT_MS, importStore } from '../../../../../store/storyHarness';
import { MOCK_SCENES } from '../..';
import { U24_CONFIRM_SWEEP_C_SCENES } from './confirm-sweep-c';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
afterEach(cleanup);

const SCENE_IDS = ['confirm-merge', 'confirm-close-pr', 'confirm-restore-backup'] as const;

const slotRects = (): ReadonlyArray<string> =>
  [...document.querySelectorAll('[data-slot]')].map((node) => {
    const rect = node.getBoundingClientRect();
    return `${node.getAttribute('data-slot')}:${rect.top}:${rect.height}`;
  });

describe('the confirm sweep c scenes', () => {
  it('registers the three scenes for the capture', () => {
    expect(Object.keys(U24_CONFIRM_SWEEP_C_SCENES)).toEqual([...SCENE_IDS]);
    for (const id of SCENE_IDS) {
      expect(MOCK_SCENES[id]).toBe(U24_CONFIRM_SWEEP_C_SCENES[id]);
    }
  });

  it('merge asks beside its button in a portal and leaves the page untouched', async () => {
    const Scene = U24_CONFIRM_SWEEP_C_SCENES['confirm-merge'];
    const { container } = render(<Scene />);
    const before = slotRects();
    const scrollHeight = document.documentElement.scrollHeight;

    fireEvent.click(screen.getByRole('button', { name: 'Merge' }));

    const dialog = screen.getByRole('dialog', { name: 'Merge #318 into main?' });
    expect(dialog.closest('[data-dropdown-portal]')).not.toBeNull();
    expect(container.contains(dialog)).toBe(false);
    expect(
      within(dialog).getByText('Squash and merge 7 commits. The branch is deleted after.'),
    ).toBeDefined();
    expect(slotRects()).toEqual(before);
    expect(document.documentElement.scrollHeight).toBe(scrollHeight);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Merge' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Merged'));
  });

  it('close puts focus on Cancel and gives it back to the button on Escape', async () => {
    const Scene = U24_CONFIRM_SWEEP_C_SCENES['confirm-close-pr'];
    render(<Scene />);
    const trigger = screen.getByRole('button', { name: 'Close' });

    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Close #318 without merging?' });
    await waitFor(() =>
      expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Cancel' })),
    );
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it('restore asks beside the row and keeps the rows still', async () => {
    const Scene = U24_CONFIRM_SWEEP_C_SCENES['confirm-restore-backup'];
    render(<Scene />);
    const before = slotRects();

    fireEvent.click(screen.getByRole('button', { name: 'Restore previous history' }));

    const dialog = screen.getByRole('dialog', { name: 'Restore the backup from 3 Oct?' });
    expect(slotRects()).toEqual(before);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Restore backup' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Restored'));
  });
});
