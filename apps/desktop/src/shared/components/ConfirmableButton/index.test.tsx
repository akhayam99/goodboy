import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ConfirmableButton } from '.';

describe('ConfirmableButton', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('arms before confirming', () => {
    const onConfirm = vi.fn();
    render(<ConfirmableButton label="Delete" armedLabel="Confirm delete" onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('disarms on blur', () => {
    render(<ConfirmableButton label="Delete" armedLabel="Confirm delete" onConfirm={vi.fn()} />);

    const button = screen.getByRole('button', { name: 'Delete' });
    fireEvent.click(button);
    fireEvent.blur(button);

    expect(screen.getByRole('button', { name: 'Delete' })).toBeDefined();
  });

  it('disarms after the configured delay', () => {
    vi.useFakeTimers();
    render(
      <ConfirmableButton
        label="Delete"
        armedLabel="Confirm delete"
        autoDisarmMs={4000}
        onConfirm={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    act(() => vi.advanceTimersByTime(4000));

    expect(screen.getByRole('button', { name: 'Delete' })).toBeDefined();
  });

  it('shows a disabled busy state while confirmation is pending', async () => {
    let finish: () => void = () => undefined;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    render(
      <ConfirmableButton
        label="Delete"
        armedLabel="Confirm delete"
        busyLabel="Deleting..."
        onConfirm={() => pending}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));

    expect(screen.getByRole('button', { name: 'Deleting...' })).toHaveProperty('disabled', true);
    finish();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Delete' })).toBeDefined());
  });
});
