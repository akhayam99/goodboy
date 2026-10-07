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

  it('xs size draws the compact strip for a header row', () => {
    render(
      <SegmentedTabs
        size="xs"
        ariaLabel="view"
        options={OPTIONS}
        value="first"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('tablist').className).toContain('p-0.5');
    screen.getAllByRole('tab').forEach((tab) => {
      expect(tab.className).toContain('py-0.5');
      expect(tab.className).toContain('rounded-sm');
    });
  });

  it('names its size so a header row can check every control shares one height', () => {
    render(
      <SegmentedTabs
        size="xs"
        ariaLabel="view"
        options={OPTIONS}
        value="first"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('tablist').getAttribute('data-size')).toBe('xs');
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

  it('card variant: marks the selected card with a check and no other one', () => {
    render(
      <SegmentedTabs
        variant="card"
        ariaLabel="How do you want to start?"
        options={[
          { value: 'first', label: 'First', hint: 'One' },
          { value: 'second', label: 'Second', hint: 'Two' },
        ]}
        value="first"
        onChange={vi.fn()}
      />,
    );

    const first = screen.getByRole('tab', { name: /First/ });
    const second = screen.getByRole('tab', { name: /Second/ });
    expect(first.textContent).toContain('One');
    expect(first.getAttribute('aria-selected')).toBe('true');
    expect(second.getAttribute('aria-selected')).toBe('false');
    expect(first.querySelectorAll('svg').length).toBeGreaterThan(
      second.querySelectorAll('svg').length,
    );
  });

  it('card variant: still moves with arrow keys and calls onChange on click', () => {
    const onChange = vi.fn();
    render(
      <SegmentedTabs
        variant="card"
        ariaLabel="How do you want to start?"
        options={OPTIONS}
        value="first"
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Second' }));
    expect(onChange).toHaveBeenCalledWith('second');
  });
});
