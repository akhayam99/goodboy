// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MOCK_SCENES } from '../..';
import { U24_CONFIRM_SCENES } from './confirm';

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
});

type MountParams = {
  readonly variant: string | null;
};

const mount = ({ variant }: MountParams): void => {
  window.history.replaceState(
    null,
    '',
    variant === null ? '/?scene=confirmpopover' : `/?scene=confirmpopover&v=${variant}`,
  );
  const Scene = U24_CONFIRM_SCENES.confirmpopover;
  render(<Scene />);
};

describe('the confirm popover scene', () => {
  it('registers one scene for the capture', () => {
    expect(Object.keys(U24_CONFIRM_SCENES)).toEqual(['confirmpopover']);
    expect(MOCK_SCENES.confirmpopover).toBe(U24_CONFIRM_SCENES.confirmpopover);
  });

  it('draws every variant when none is asked for', () => {
    mount({ variant: null });

    expect(screen.getAllByRole('region')).toHaveLength(6);
  });

  it('notifications arms the confirm beside its button and focuses Cancel', async () => {
    mount({ variant: 'notifications' });

    const trigger = screen.getByRole('button', { name: 'Delete all' });
    fireEvent.click(trigger);

    const dialog = screen.getByRole('dialog', { name: 'Delete 12 notifications?' });
    expect(dialog.closest('[data-dropdown-portal]')).not.toBeNull();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    await waitFor(() =>
      expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Cancel' })),
    );
    expect(screen.queryByRole('group', { name: 'Delete 12 notifications?' })).not.toBeNull();
  });

  it('sessiondelete confirms from the keyboard with Cmd+Enter', async () => {
    mount({ variant: 'sessiondelete' });

    fireEvent.click(screen.getByRole('button', { name: 'Delete session' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete this session?' });
    fireEvent.keyDown(within(dialog).getByRole('button', { name: 'Cancel' }), {
      key: 'Enter',
      metaKey: true,
    });

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('chatrow removes the row and lands focus on the next one', async () => {
    mount({ variant: 'chatrow' });

    fireEvent.click(screen.getByRole('button', { name: 'Delete Where is the consent step?' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(screen.queryByText('Where is the consent step?')).toBeNull());
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Delete Refund idempotency options' }),
      ),
    );
  });

  it('rich keeps its list, note and alternative inside the one popover', () => {
    mount({ variant: 'rich' });

    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
    const dialog = screen.getByRole('dialog', { name: 'Disconnect Cascadia?' });

    expect(within(dialog).getByText('payments-api')).toBeDefined();
    expect(within(dialog).getByText('Your repositories are not touched.')).toBeDefined();
    expect(within(dialog).getByRole('button', { name: 'Archive instead' })).toBeDefined();
  });

  it('activity focuses the confirm for an alert and stops on Enter', async () => {
    mount({ variant: 'activity' });

    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    const dialog = screen.getByRole('dialog', { name: 'Stop this run?' });

    await waitFor(() =>
      expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Stop run' })),
    );
  });

  it('note deletes one note and keeps the other', async () => {
    mount({ variant: 'note' });

    fireEvent.click(screen.getByRole('button', { name: /^Delete note Rename the ledger-core/ }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(screen.queryByText(/^Rename the ledger-core/)).toBeNull());
    expect(screen.getByText(/^Cover the empty batch/)).toBeDefined();
  });
});
