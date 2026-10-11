// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MOCK_SCENES } from '../..';
import { U24_CONFIRM_SWEEP_A_SCENES } from './confirm-sweep-a';

afterEach(cleanup);

const SCENE_IDS = [
  'confirm-session-delete',
  'confirm-chat-delete',
  'confirm-worktree-remove',
  'confirm-action-panel',
] as const;

const slotRects = (): ReadonlyArray<string> =>
  [...document.querySelectorAll('[data-slot]')].map((node) => {
    const rect = node.getBoundingClientRect();
    return `${node.getAttribute('data-slot')}:${rect.top}:${rect.height}`;
  });

describe('the confirm sweep a scenes', () => {
  it('registers the four scenes for the capture', () => {
    expect(Object.keys(U24_CONFIRM_SWEEP_A_SCENES)).toEqual([...SCENE_IDS]);
    for (const id of SCENE_IDS) {
      expect(MOCK_SCENES[id]).toBe(U24_CONFIRM_SWEEP_A_SCENES[id]);
    }
  });

  it('session delete asks in a portal popover and leaves the page untouched', () => {
    const Scene = U24_CONFIRM_SWEEP_A_SCENES['confirm-session-delete'];
    const { container } = render(<Scene />);
    const before = slotRects();
    const scrollHeight = document.documentElement.scrollHeight;

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    const dialog = screen.getByRole('dialog', { name: 'Delete Speed up the payout export?' });
    expect(dialog.closest('[data-dropdown-portal]')).not.toBeNull();
    expect(container.contains(dialog)).toBe(false);
    expect(slotRects()).toEqual(before);
    expect(document.documentElement.scrollHeight).toBe(scrollHeight);
  });

  it('session delete returns focus to the trigger on Escape', async () => {
    const Scene = U24_CONFIRM_SWEEP_A_SCENES['confirm-session-delete'];
    render(<Scene />);
    const trigger = screen.getByRole('button', { name: 'Delete' });
    fireEvent.click(trigger);

    fireEvent.keyDown(screen.getByRole('button', { name: 'Cancel' }), { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it('chat delete removes the row and moves focus to the next row', async () => {
    const Scene = U24_CONFIRM_SWEEP_A_SCENES['confirm-chat-delete'];
    render(<Scene />);
    const before = slotRects();

    fireEvent.click(screen.getByRole('button', { name: 'Delete Where is the consent step?' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete "Where is the consent step?"?' });
    expect(slotRects()).toEqual(before);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete chat' }));

    await waitFor(() => expect(screen.queryByText('Where is the consent step?')).toBeNull());
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Delete Refund idempotency options' }),
      ),
    );
  });

  it('worktree remove opens a wide popover with its consequence lines', () => {
    const Scene = U24_CONFIRM_SWEEP_A_SCENES['confirm-worktree-remove'];
    render(<Scene />);
    const before = slotRects();

    fireEvent.click(screen.getByRole('button', { name: 'Close branch for notify-relay' }));

    const dialog = screen.getByRole('dialog', { name: 'Close branch for notify-relay?' });
    expect(dialog.closest('[data-dropdown-portal]')).not.toBeNull();
    expect(within(dialog).getByText(/3 uncommitted files/)).toBeDefined();
    expect(slotRects()).toEqual(before);
  });

  it('action panel anchors the merge confirm and confirms with the picked method', async () => {
    const Scene = U24_CONFIRM_SWEEP_A_SCENES['confirm-action-panel'];
    render(<Scene />);
    const before = slotRects();

    fireEvent.click(screen.getByRole('button', { name: 'Merge' }));
    const dialog = screen.getByRole('dialog', { name: 'Merge #318 into main?' });
    expect(dialog.closest('[data-dropdown-portal]')).not.toBeNull();
    expect(slotRects()).toEqual(before);
    fireEvent.click(within(dialog).getByRole('tab', { name: /Rebase and merge/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Merge pull request' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Merged' })).toBeDefined());
  });
});
