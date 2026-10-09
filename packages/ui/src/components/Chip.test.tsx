// @vitest-environment happy-dom

import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Chip } from './Chip';
import { Tooltip } from './Tooltip';

describe('Chip', () => {
  afterEach(cleanup);

  it('hands its button element to a ref', () => {
    const ref = createRef<HTMLElement>();
    render(<Chip as="button" tone="neutral" label="Context" ref={ref} />);

    expect(ref.current).toBe(screen.getByRole('button', { name: 'Context' }));
  });

  it('hands its span element to a ref', () => {
    const ref = createRef<HTMLElement>();
    render(<Chip tone="neutral" label="Open" testId="chip" ref={ref} />);

    expect(ref.current).toBe(screen.getByTestId('chip'));
  });

  it('forwards pointer and focus handlers to the element', () => {
    const onMouseEnter = vi.fn();
    const onFocus = vi.fn();
    render(
      <Chip
        as="button"
        tone="neutral"
        label="Context"
        onMouseEnter={onMouseEnter}
        onFocus={onFocus}
      />,
    );

    const button = screen.getByRole('button', { name: 'Context' });
    fireEvent.mouseEnter(button);
    fireEvent.focus(button);

    expect(onMouseEnter).toHaveBeenCalledTimes(1);
    expect(onFocus).toHaveBeenCalledTimes(1);
  });

  it('shows a Tooltip wrapped directly around it', () => {
    render(
      <Tooltip content="Reports and plans">
        <Chip as="button" tone="neutral" label="Artifacts" />
      </Tooltip>,
    );

    vi.useFakeTimers();
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Artifacts' }));
    act(() => {
      vi.advanceTimersByTime(400);
    });
    vi.useRealTimers();

    expect(screen.getByRole('tooltip').textContent).toBe('Reports and plans');
  });
});
