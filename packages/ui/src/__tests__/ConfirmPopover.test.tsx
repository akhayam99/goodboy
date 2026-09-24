// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ConfirmPopover } from '../components/ConfirmPopover';

afterEach(cleanup);

type HarnessProps = {
  readonly onConfirm: () => void | Promise<void>;
};

const Harness = ({ onConfirm }: HarnessProps) => (
  <div>
    <ConfirmPopover
      role="danger"
      icon={null}
      title="Delete workflow run?"
      confirmLabel="Delete"
      onConfirm={onConfirm}
      trigger={({ isArmed, arm }) => (
        <button type="button" aria-expanded={isArmed} onClick={arm}>
          Delete run
        </button>
      )}
    />
    <button type="button">Outside</button>
  </div>
);

const Controlled = ({ onConfirm }: HarnessProps) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div>
      <ConfirmPopover
        role="alert"
        icon={null}
        title="Start anyway?"
        confirmLabel="Start"
        isOpen={isOpen}
        onConfirm={async () => {
          await onConfirm();
          setIsOpen(false);
        }}
        onCancel={() => setIsOpen(false)}
        trigger={() => (
          <button type="button" onClick={() => setIsOpen(true)}>
            Start
          </button>
        )}
      />
      <span>{isOpen ? 'armed' : 'idle'}</span>
    </div>
  );
};

describe('ConfirmPopover', () => {
  it('arms from the trigger without acting', () => {
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete run' }));

    expect(screen.getByRole('dialog', { name: 'Delete workflow run?' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Delete run' }).getAttribute('aria-expanded')).toBe(
      'true',
    );
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('renders the plain confirm body inside a body portal', () => {
    render(<Harness onConfirm={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete run' }));

    const group = screen.getByRole('group', { name: 'Delete workflow run?' });
    expect(group.getAttribute('data-surface')).toBe('plain');
    expect(group.closest('[data-dropdown-portal]')?.parentElement).toBe(document.body);
  });

  it('cancels on Escape and on an outside click', () => {
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete run' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Delete run' }));
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Outside' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('stays open and busy while the confirm runs, then closes', async () => {
    let finish: () => void = () => undefined;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    render(<Harness onConfirm={() => pending} />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete run' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveProperty('disabled', true);

    finish();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('moves focus to cancel on arm and back to the trigger on cancel', async () => {
    render(<Harness onConfirm={vi.fn()} />);
    const trigger = screen.getByRole('button', { name: 'Delete run' });

    fireEvent.click(trigger);
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' })),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it('follows a controlled open flag and reports Escape as a cancel', async () => {
    const onConfirm = vi.fn();
    render(<Controlled onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    await waitFor(() =>
      expect(screen.getByRole('dialog', { name: 'Start anyway?' })).toBeDefined(),
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.getByText('idle')).toBeDefined());
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeDefined());
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Start' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
