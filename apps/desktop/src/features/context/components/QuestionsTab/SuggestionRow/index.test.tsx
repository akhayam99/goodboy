// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SuggestionRow } from '.';

afterEach(cleanup);

const longAnswer =
  'il refactor è su un altro branch e va rebasato prima di rilanciare lo step precedente, ' +
  'altrimenti la build parte dal codice vecchio';

describe('SuggestionRow', () => {
  it('renders the label and fires onToggle when clicked', () => {
    const onToggle = vi.fn();
    render(<SuggestionRow label="yes" selected={false} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('radio', { name: 'yes' }));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('renders selected styling when selected', () => {
    render(<SuggestionRow label="yes" selected onToggle={() => undefined} />);
    const btn = screen.getByRole('radio', { name: 'yes' });
    expect(btn.className).toContain('bg-primary/10');
  });

  it('uses the checkbox role and aria-checked in multi-choice mode', () => {
    render(<SuggestionRow label="yes" selected mode="many" onToggle={() => undefined} />);
    const btn = screen.getByRole('checkbox', { name: 'yes' });
    expect(btn.getAttribute('aria-checked')).toBe('true');
  });

  it('takes a full row of its own rather than sizing to its text', () => {
    render(<SuggestionRow label="yes" selected={false} onToggle={() => undefined} />);
    const btn = screen.getByRole('radio', { name: 'yes' });
    expect(btn.className).toContain('w-full');
    expect(btn.className).not.toContain('max-w-');
    expect(btn.className).not.toContain('inline-flex');
  });

  it('carries a long answer whole and wraps it instead of truncating', () => {
    render(<SuggestionRow label={longAnswer} selected={false} onToggle={() => undefined} />);
    const btn = screen.getByRole('radio', { name: longAnswer });
    const text = btn.querySelector('span:last-child');

    expect(text?.textContent).toBe(longAnswer);
    expect(text?.className).toContain('whitespace-normal');
    expect(text?.className).toContain('break-words');
    expect(btn.innerHTML).not.toContain('truncate');
    expect(btn.innerHTML).not.toContain('line-clamp');
  });

  it('keeps the suggested glyph and its emphasis on the recommended answer', () => {
    render(<SuggestionRow label="yes" selected={false} recommended onToggle={() => undefined} />);
    const btn = screen.getByTitle('yes (suggested)');

    expect(btn.className).toContain('border-warning/40');
    expect(btn.querySelector('svg')).not.toBeNull();
  });
});
