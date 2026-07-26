// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SegmentedTabs } from '../components/SegmentedTabs';

const OPTIONS = [
  { value: 'first', label: 'First' },
  { value: 'second', label: 'Second' },
  { value: 'third', label: 'Third', disabled: true },
] as const;

afterEach(cleanup);

describe('SegmentedTabs', () => {
  it('renders every option and marks the selected tab', () => {
    render(<SegmentedTabs ariaLabel="view" options={OPTIONS} value="first" onChange={vi.fn()} />);

    expect(screen.getAllByRole('tab')).toHaveLength(3);
    expect(screen.getByRole('tab', { name: 'First' }).getAttribute('aria-selected')).toBe('true');
  });

  it('changes the selected value on click', () => {
    const onChange = vi.fn();
    render(<SegmentedTabs ariaLabel="view" options={OPTIONS} value="first" onChange={onChange} />);

    fireEvent.click(screen.getByRole('tab', { name: 'Second' }));

    expect(onChange).toHaveBeenCalledWith('second');
  });

  it('moves selection with arrow keys and skips disabled options', () => {
    const onChange = vi.fn();
    render(<SegmentedTabs ariaLabel="view" options={OPTIONS} value="second" onChange={onChange} />);

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Second' }), { key: 'ArrowRight' });

    expect(onChange).toHaveBeenCalledWith('first');
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'First' }));
  });

  it('does not select a disabled option', () => {
    const onChange = vi.fn();
    render(<SegmentedTabs ariaLabel="view" options={OPTIONS} value="first" onChange={onChange} />);

    fireEvent.click(screen.getByRole('tab', { name: 'Third' }));

    expect(onChange).not.toHaveBeenCalled();
  });
});
