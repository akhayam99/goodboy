// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Profiler } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { InlineConfirm, type ConfirmRole } from '../components/InlineConfirm';

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

  it('shows a rejected confirmation inside the card and keeps it open', async () => {
    render(
      <InlineConfirm
        role="alert"
        icon={null}
        title="Restore built-in workflows?"
        confirmLabel="Restore 1"
        onConfirm={async () => {
          throw new Error(
            'Refactor is running in Northwind checkout. Restore it when the run ends.',
          );
        }}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Restore 1' }));

    await screen.findByRole('alert');
    screen.getByRole('group', { name: 'Restore built-in workflows?' });
    expect(screen.getByRole('alert').textContent).toBe(
      'Refactor is running in Northwind checkout. Restore it when the run ends.',
    );
  });

  it('keeps the successful confirmation to its busy redraws', async () => {
    let finish: () => void = () => undefined;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const commits: string[] = [];
    render(
      <Profiler id="confirm" onRender={(_id, phase) => commits.push(phase)}>
        <InlineConfirm
          role="alert"
          icon={null}
          title="Restore built-in workflows?"
          confirmLabel="Restore 1"
          onConfirm={() => pending}
          onCancel={vi.fn()}
        />
      </Profiler>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Restore 1' }));
    finish();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Restore 1' })).toHaveProperty('disabled', false),
    );

    expect(commits).toEqual(['mount', 'update', 'update']);
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

  it('offers a third way out without touching confirm or cancel', () => {
    const onAlt = vi.fn();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <InlineConfirm
        role="danger"
        icon={null}
        title="Delete session?"
        confirmLabel="Delete"
        altAction={{ label: 'Archive instead', onClick: onAlt }}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Archive instead' }));

    expect(onAlt).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('locks the third action while the confirmation is pending', () => {
    render(
      <InlineConfirm
        role="danger"
        icon={null}
        title="Delete session?"
        confirmLabel="Delete"
        isBusy
        altAction={{ label: 'Archive instead', onClick: vi.fn() }}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Archive instead' })).toHaveProperty(
      'disabled',
      true,
    );
  });

  it('sits in popover chrome without a nested card on the plain surface', () => {
    render(
      <InlineConfirm
        role="danger"
        icon={null}
        title="Detach payments-api?"
        confirmLabel="Detach"
        surface="plain"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const group = screen.getByRole('group', { name: 'Detach payments-api?' });
    expect(group.className).not.toContain('border');
    expect(group.className).not.toContain('rounded-lg');
  });

  it('maps danger to the one solid red button and alert to the primary button', () => {
    const { rerender } = render(
      <InlineConfirm
        role="danger"
        icon={null}
        title="Delete?"
        confirmLabel="Go"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Go' }).className).toContain('bg-danger');
    expect(screen.getByRole('button', { name: 'Cancel' }).className).toContain('bg-fill');

    rerender(
      <InlineConfirm
        role="alert"
        icon={null}
        title="Delete?"
        confirmLabel="Go"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Go' }).className).toContain('bg-primary');
    expect(screen.getByRole('button', { name: 'Go' }).className).not.toContain('bg-warning');

    rerender(
      <InlineConfirm
        role="primary"
        icon={null}
        title="Delete?"
        confirmLabel="Go"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Go' }).className).toContain('bg-primary');
  });
});

const card = (role: ConfirmRole) =>
  render(
    <InlineConfirm
      role={role}
      icon={<svg />}
      title="Push 3 comments?"
      confirmLabel="Push"
      onConfirm={vi.fn()}
      onCancel={vi.fn()}
    />,
  );

describe('InlineConfirm card', () => {
  it('is a neutral card: no tinted fill and no tinted border', () => {
    card('primary');

    const group = screen.getByRole('group', { name: 'Push 3 comments?' });
    const classes = group.className.split(' ');
    expect(classes).toEqual(expect.arrayContaining(['bg-subtle', 'border-border-soft']));
    expect(group.className).not.toMatch(/\b(bg|border)-(primary|warning|danger)/);
  });

  it.each([
    ['primary', 'primary'],
    ['alert', 'warning'],
    ['danger', 'danger'],
  ] as const)('carries its %s tone as an inner line', (role, tone) => {
    card(role);

    const bar = screen.getByTestId('tone-bar');
    expect(bar.getAttribute('data-tone')).toBe(tone);
    expect(screen.getByRole('group').contains(bar)).toBe(true);
  });

  it('draws no tone line on the plain surface used inside a menu', () => {
    render(
      <InlineConfirm
        role="danger"
        icon={<svg />}
        title="Delete?"
        confirmLabel="Delete"
        surface="plain"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('tone-bar')).toBeNull();
  });

  it('makes the confirm button the one filled primary of a primary confirm', () => {
    card('primary');

    expect(document.querySelectorAll('button[data-variant="primary"]')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Push' }).getAttribute('data-variant')).toBe(
      'primary',
    );
    expect(screen.getByRole('button', { name: 'Cancel' }).getAttribute('data-variant')).toBe(
      'secondary',
    );
  });

  it('uses the danger variant for a danger confirm and calls back on click', () => {
    const onConfirm = vi.fn();
    render(
      <InlineConfirm
        role="danger"
        icon={<svg />}
        title="Delete?"
        confirmLabel="Delete"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );

    const confirm = screen.getByRole('button', { name: 'Delete' });
    expect(confirm.getAttribute('data-variant')).toBe('danger');
    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
