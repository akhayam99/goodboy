// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { LinkedLogText } from '.';

afterEach(cleanup);

describe('LinkedLogText', () => {
  it('turns a path with a line into a link that hands it over on click and Enter', () => {
    const onOpenFile = vi.fn();
    render(<LinkedLogText text="FAIL src/rounding.ts:42:13 expected 2" onOpenFile={onOpenFile} />);

    fireEvent.click(screen.getByRole('link', { name: 'Open src/rounding.ts:42:13' }));

    expect(onOpenFile).toHaveBeenCalledWith({ path: 'src/rounding.ts', line: 42, column: 13 });

    fireEvent.keyDown(screen.getByRole('link', { name: 'Open src/rounding.ts:42:13' }), {
      key: 'Enter',
    });
    expect(onOpenFile).toHaveBeenCalledTimes(2);
  });

  it('keeps plain text plain when there is no handler or no path', () => {
    const { container, rerender } = render(
      <LinkedLogText text="src/rounding.ts:42" onOpenFile={null} />,
    );
    expect(container.textContent).toBe('src/rounding.ts:42');
    expect(screen.queryByRole('link')).toBeNull();

    rerender(<LinkedLogText text="all green" onOpenFile={vi.fn()} />);
    expect(screen.queryByRole('link')).toBeNull();
  });
});
