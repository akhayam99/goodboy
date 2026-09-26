// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { VerbositySelect } from './index';

afterEach(cleanup);

describe('VerbositySelect', () => {
  it('renders the current verbosity and lists every level', () => {
    render(<VerbositySelect value="normal" onChange={vi.fn()} disabled={false} />);
    const trigger = screen.getByRole('combobox', { name: 'Reply verbosity' });
    expect(trigger.textContent).toContain('Normal');

    fireEvent.click(trigger);
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Brief',
      'Normal',
      'Verbose',
    ]);
  });

  it('disables the trigger when disabled is true', () => {
    render(<VerbositySelect value="normal" onChange={vi.fn()} disabled />);
    expect(
      screen.getByRole<HTMLButtonElement>('combobox', { name: 'Reply verbosity' }).disabled,
    ).toBe(true);
  });
});
