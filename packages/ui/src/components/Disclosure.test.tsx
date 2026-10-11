// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Disclosure } from './Disclosure';
import { ICON_SIZE } from '../iconSize';

afterEach(cleanup);

describe('Disclosure', () => {
  it('hides the body while closed and wires aria-controls when open', () => {
    const { rerender } = render(
      <Disclosure label="Notes" isOpen={false} onToggle={vi.fn()}>
        <p>Body</p>
      </Disclosure>,
    );
    const toggle = screen.getByRole('button', { name: 'Notes' });

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('Body')).toBeNull();

    rerender(
      <Disclosure label="Notes" isOpen onToggle={vi.fn()}>
        <p>Body</p>
      </Disclosure>,
    );

    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(
      document
        .getElementById(toggle.getAttribute('aria-controls') ?? '')
        ?.contains(screen.getByText('Body')),
    ).toBe(true);
  });

  it('reports a toggle click', () => {
    const onToggle = vi.fn();
    render(
      <Disclosure label="Notes" isOpen={false} onToggle={onToggle}>
        <p>Body</p>
      </Disclosure>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Notes' }));

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('indents the body by the toggle padding, chevron and gap', () => {
    render(
      <Disclosure label="Notes" isOpen onToggle={vi.fn()}>
        <p>Body</p>
      </Disclosure>,
    );

    expect(ICON_SIZE.control).toBe(14);
    expect(screen.getByText('Body').parentElement?.className).toContain(
      `pl-[calc(8px+${ICON_SIZE.control}px+8px)]`,
    );
  });
});
