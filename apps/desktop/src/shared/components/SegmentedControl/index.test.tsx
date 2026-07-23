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

    expect(screen.getByRole('radio', { name: 'Mine' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: 'Others' }).getAttribute('aria-checked')).toBe(
      'false',
    );
    fireEvent.click(screen.getByRole('radio', { name: 'Others' }));
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

    expect(screen.getByRole('radiogroup', { name: 'Review inbox filter' })).toBeDefined();
  });
});
