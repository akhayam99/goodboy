// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NeedsYouElsewhere } from './NeedsYouElsewhere';

afterEach(cleanup);

describe('NeedsYouElsewhere', () => {
  it('draws nothing at zero', () => {
    const { container } = render(<NeedsYouElsewhere count={0} onClear={vi.fn()} />);

    expect(container.textContent).toBe('');
  });

  it('says how many more need you in other projects, in the singular for one', () => {
    const { rerender } = render(<NeedsYouElsewhere count={1} onClear={vi.fn()} />);
    screen.getByRole('button', { name: '1 more needs you in other projects' });

    rerender(<NeedsYouElsewhere count={3} onClear={vi.fn()} />);
    screen.getByRole('button', { name: '3 more need you in other projects' });
  });

  it('clears the filter on a click', () => {
    const onClear = vi.fn();
    render(<NeedsYouElsewhere count={2} onClear={onClear} />);

    fireEvent.click(screen.getByRole('button'));

    expect(onClear).toHaveBeenCalledOnce();
  });
});
