// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Bug } from 'lucide-react';
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
    expect(screen.getByRole('tablist', { name: 'view' })).toBeDefined();
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

  it('sits the icon in the heading line, immediately before the label it names', () => {
    render(
      <SegmentedTabs
        size="md"
        ariaLabel="Issue type"
        options={[{ value: 'bug', label: 'Bug', icon: Bug, hint: 'Something broke' }]}
        value="bug"
        onChange={vi.fn()}
      />,
    );

    const icon = screen.getByRole('tab', { name: /Bug/ }).querySelector('svg');

    expect(icon?.nextElementSibling?.textContent).toBe('Bug');
    expect(icon?.parentElement?.textContent).toBe('Bug');
  });
});
