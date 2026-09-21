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

  it('draws a circle for one answer and a square for many', () => {
    const single = render(
      <SuggestionRow label="yes" selected={false} onToggle={() => undefined} />,
    );
    const circle = single.getByRole('radio', { name: 'yes' }).querySelector('span[aria-hidden]');
    expect(circle?.className).toContain('rounded-full');
    single.unmount();

    render(<SuggestionRow label="yes" selected={false} mode="many" onToggle={() => undefined} />);
    const square = screen.getByRole('checkbox', { name: 'yes' }).querySelector('span[aria-hidden]');
    expect(square?.className).toContain('rounded-[4px]');
    expect(square?.className).not.toContain('rounded-full');
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

    expect(btn.textContent).toBe(longAnswer);
    expect(btn.innerHTML).toContain('whitespace-normal');
    expect(btn.innerHTML).toContain('break-words');
    expect(btn.innerHTML).not.toContain('truncate');
    expect(btn.innerHTML).not.toContain('line-clamp');
  });

  it('marks the recommended answer with an icon and a description, not a colour', () => {
    render(<SuggestionRow label="yes" selected={false} recommended onToggle={() => undefined} />);
    const btn = screen.getByRole('radio', { name: 'yes', description: 'Recommended answer' });

    expect(btn.querySelector('svg')).not.toBeNull();
    expect(btn.className).not.toContain('bg-warning');
    expect(btn.className).not.toContain('border-warning');
    expect(btn.className).not.toContain('bg-primary');
  });

  it('keeps one type size and family whatever the answer looks like', () => {
    render(<SuggestionRow label="pnpm run build()" selected={false} onToggle={() => undefined} />);
    const btn = screen.getByRole('radio', { name: 'pnpm run build()' });

    expect(btn.className).toContain('text-sm');
    expect(btn.className).not.toContain('font-mono');
    expect(btn.className).not.toContain('text-2xs');
  });
});
