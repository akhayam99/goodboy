// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { VerbositySelect } from './index';

afterEach(cleanup);

describe('VerbositySelect', () => {
  it('shows every level in the row and marks the current one', () => {
    render(<VerbositySelect value="normal" onChange={vi.fn()} disabled={false} />);
    const group = screen.getByRole('tablist', { name: 'Reply verbosity' });
    const tabs = screen.getAllByRole('tab');

    expect(group).toBeDefined();
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Brief', 'Normal', 'Verbose']);
    expect(tabs.map((tab) => tab.getAttribute('aria-selected'))).toEqual([
      'false',
      'true',
      'false',
    ]);
  });

  it('picks a level on a click', () => {
    const onChange = vi.fn();
    render(<VerbositySelect value="normal" onChange={onChange} disabled={false} />);

    fireEvent.click(screen.getByRole('tab', { name: 'Verbose' }));

    expect(onChange).toHaveBeenCalledWith('verbose');
  });

  it('disables every level when disabled is true', () => {
    render(<VerbositySelect value="normal" onChange={vi.fn()} disabled />);

    expect(screen.getAllByRole<HTMLButtonElement>('tab').every((tab) => tab.disabled)).toBe(true);
  });
});
