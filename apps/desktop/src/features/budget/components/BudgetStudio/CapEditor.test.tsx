// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
