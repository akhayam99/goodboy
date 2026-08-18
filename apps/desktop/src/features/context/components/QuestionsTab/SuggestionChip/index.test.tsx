// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SuggestionChip } from '.';

afterEach(cleanup);

describe('SuggestionChip', () => {
  it('renders the label and fires onToggle when clicked', () => {
    const onToggle = vi.fn();
    render(<SuggestionChip label="yes" selected={false} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('radio', { name: 'yes' }));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('renders selected styling when selected', () => {
    render(<SuggestionChip label="yes" selected onToggle={() => undefined} />);
    const btn = screen.getByRole('radio', { name: 'yes' });
    expect(btn.className).toContain('bg-primary/10');
  });

  it('uses the checkbox role and aria-checked in multi-choice mode', () => {
    render(<SuggestionChip label="yes" selected mode="many" onToggle={() => undefined} />);
    const btn = screen.getByRole('checkbox', { name: 'yes' });
    expect(btn.getAttribute('aria-checked')).toBe('true');
  });
});
