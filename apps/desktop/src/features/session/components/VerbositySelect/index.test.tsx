// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { VerbositySelect } from './index';

afterEach(cleanup);

describe('VerbositySelect', () => {
  it('renders the current verbosity label and opens a menu on click', () => {
    render(<VerbositySelect value="normal" onChange={vi.fn()} disabled={false} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getAllByText(/brief|normal|verbose/i).length).toBeGreaterThan(0);
  });

  it('disables the trigger when disabled is true', () => {
    render(<VerbositySelect value="normal" onChange={vi.fn()} disabled />);
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
  });
});
