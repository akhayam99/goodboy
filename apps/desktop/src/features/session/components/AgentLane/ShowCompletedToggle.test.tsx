import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ShowCompletedToggle } from './ShowCompletedToggle';

afterEach(cleanup);

describe('ShowCompletedToggle', () => {
  it('stays hidden without completed agents', () => {
    render(<ShowCompletedToggle completedCount={0} isShown={false} onChange={vi.fn()} />);

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows the count and toggles its pressed state', () => {
    const onChange = vi.fn();
    render(<ShowCompletedToggle completedCount={3} isShown={false} onChange={onChange} />);

    const toggle = screen.getByRole('button', { name: 'Completed (3)' });
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(toggle);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
