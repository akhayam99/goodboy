// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PageTabs } from './PageTabs';

afterEach(cleanup);

const OPTIONS = [
  { value: 'overview', label: 'Overview' },
  { value: 'comments', label: 'Comments', badge: <span>9</span> },
  { value: 'checks', label: 'Checks', disabled: true },
];

describe('PageTabs', () => {
  it('draws an underlined 36 row of tabs with the count beside the label', () => {
    render(<PageTabs ariaLabel="Pages" options={OPTIONS} value="overview" onChange={vi.fn()} />);

    const list = screen.getByRole('tablist', { name: 'Pages' });
    expect(list.className).toContain('h-9');
    expect(list.className).toContain('after:bottom-0');
    expect(list.className).toContain('after:h-px');
    expect(list.className).toContain('after:bg-border-soft');
    expect(list.className).not.toContain('border-b');
    expect(list.className).not.toContain('rounded');
    expect(screen.getByRole('tab', { name: /Comments/ }).textContent).toBe('Comments9');
  });

  it('marks the selected tab with a primary after underline and no fill', () => {
    render(<PageTabs ariaLabel="Pages" options={OPTIONS} value="comments" onChange={vi.fn()} />);

    const selected = screen.getByRole('tab', { name: /Comments/ });
    expect(selected.getAttribute('aria-selected')).toBe('true');
    expect(selected.className).toContain('after:bg-primary');
    expect(selected.className).toContain('after:h-0.5');
    expect(selected.className).not.toContain('bg-selected');
    expect(screen.getByRole('tab', { name: 'Overview' }).className).not.toContain(
      'after:bg-primary',
    );
  });

  it('selects on click and moves with the arrow keys', () => {
    const onChange = vi.fn();
    render(<PageTabs ariaLabel="Pages" options={OPTIONS} value="overview" onChange={onChange} />);

    fireEvent.click(screen.getByRole('tab', { name: /Comments/ }));
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Overview' }), { key: 'ArrowRight' });

    expect(onChange).toHaveBeenCalledWith('comments');
    expect(onChange).toHaveBeenCalledTimes(2);
  });
});
