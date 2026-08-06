// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CapEditor } from './CapEditor';

afterEach(cleanup);

describe('CapEditor', () => {
  it('preserves in-progress typing when a late budget load resolves', () => {
    const view = render(
      <CapEditor label="session soft cap" currentCapUsd={null} onSave={vi.fn()} />,
    );
    const input = screen.getByLabelText('session soft cap') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '12' } });

    view.rerender(<CapEditor label="session soft cap" currentCapUsd={5} onSave={vi.fn()} />);

    expect(input.value).toBe('12');
  });

  it('updates an untouched draft when the current cap changes', () => {
    const view = render(
      <CapEditor label="session soft cap" currentCapUsd={null} onSave={vi.fn()} />,
    );
    const input = screen.getByLabelText('session soft cap') as HTMLInputElement;

    view.rerender(<CapEditor label="session soft cap" currentCapUsd={5} onSave={vi.fn()} />);

    expect(input.value).toBe('5');
  });
});

describe('CapEditor, alert threshold', () => {
  it('saves the edited threshold through the threshold save path', async () => {
    const onSaveThreshold = vi.fn(async () => undefined);
    render(
      <CapEditor
        label="monthly cap"
        currentCapUsd={50}
        threshold={{ pct: 80, onSave: onSaveThreshold }}
        onSave={vi.fn()}
      />,
    );
    const input = screen.getByLabelText('alert threshold percent') as HTMLInputElement;
    expect(input.value).toBe('80');

    fireEvent.change(input, { target: { value: '60' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update threshold' }));

    await waitFor(() => expect(onSaveThreshold).toHaveBeenCalledWith(60));
  });

  it('refuses a threshold outside 1 to 100', () => {
    const onSaveThreshold = vi.fn(async () => undefined);
    render(
      <CapEditor
        label="monthly cap"
        currentCapUsd={50}
        threshold={{ pct: 80, onSave: onSaveThreshold }}
        onSave={vi.fn()}
      />,
    );
    const input = screen.getByLabelText('alert threshold percent');

    fireEvent.change(input, { target: { value: '150' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update threshold' }));

    expect(onSaveThreshold).not.toHaveBeenCalled();
  });

  it('hides the control on the session mount, which has no threshold', () => {
    render(<CapEditor label="session soft cap" currentCapUsd={50} onSave={vi.fn()} />);

    expect(screen.queryByLabelText('alert threshold percent')).toBeNull();
  });

  it('hides the control until a cap exists to measure against', () => {
    render(
      <CapEditor
        label="monthly cap"
        currentCapUsd={null}
        threshold={{ pct: 80, onSave: vi.fn() }}
        onSave={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText('alert threshold percent')).toBeNull();
  });
});
