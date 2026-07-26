// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SegmentedControl } from './index';

const OPTIONS = [
  { value: 'mine', label: 'Mine' },
  { value: 'others', label: 'Others' },
  { value: 'all', label: 'All' },
] as const;

afterEach(cleanup);

describe('SegmentedControl', () => {
  it('marks the active option and switches on click', () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        ariaLabel="Review inbox filter"
        options={OPTIONS}
        value="mine"
        onChange={onChange}
      />,
    );

    expect(screen.getByRole('tab', { name: 'Mine' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Others' }).getAttribute('aria-selected')).toBe('false');
    fireEvent.click(screen.getByRole('tab', { name: 'Others' }));
    expect(onChange).toHaveBeenCalledWith('others');
  });

  it('exposes the group with its accessible label', () => {
    render(
      <SegmentedControl
        ariaLabel="Review inbox filter"
        options={OPTIONS}
        value="all"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('tablist', { name: 'Review inbox filter' })).toBeDefined();
  });
});
