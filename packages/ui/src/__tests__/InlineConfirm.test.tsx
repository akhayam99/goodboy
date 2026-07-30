// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { InlineConfirm } from '../components/InlineConfirm';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('InlineConfirm', () => {
  it('never confirms without an explicit click on the confirm control', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <InlineConfirm
        role="danger"
        icon={null}
        title="Delete session?"
        confirmLabel="Delete"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    fireEvent.click(screen.getByText('Delete session?'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('locks both controls while the confirmation is pending', async () => {
    let finish: () => void = () => undefined;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    render(
      <InlineConfirm
        role="danger"
        icon={null}
        title="Delete session?"
        confirmLabel="Delete"
        onConfirm={() => pending}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveProperty('disabled', true);

    finish();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Delete' })).toHaveProperty('disabled', false),
    );
  });

  it('cancels itself after the configured delay', () => {
    vi.useFakeTimers();
    const onCancel = vi.fn();
    render(
      <InlineConfirm
        role="alert"
        icon={null}
        title="Skip the blocked step?"
        confirmLabel="Skip"
        autoDisarmMs={4000}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );

    act(() => vi.advanceTimersByTime(4000));

    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('renders the description, children and note slots', () => {
    render(
      <InlineConfirm
        role="primary"
        icon={null}
        title="Delete 2 sessions?"
        description="This cannot be undone."
        confirmLabel="Delete"
        note={<textarea aria-label="Resolution note" />}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      >
        <span>refactor auth</span>
      </InlineConfirm>,
    );

    expect(screen.getByText('This cannot be undone.')).toBeDefined();
    expect(screen.getByText('refactor auth')).toBeDefined();
    expect(screen.getByLabelText('Resolution note')).toBeDefined();
  });
});
