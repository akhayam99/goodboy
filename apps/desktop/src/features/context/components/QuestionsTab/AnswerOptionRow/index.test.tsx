// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AnswerOptionRow } from '.';

afterEach(cleanup);

describe('AnswerOptionRow', () => {
  it('shows the key and fires onToggle when clicked', () => {
    const onToggle = vi.fn();
    render(<AnswerOptionRow label="yes" keyHint={1} selected={false} onToggle={onToggle} />);
    screen.getByText('1');
    fireEvent.click(screen.getByRole('radio', { name: 'yes' }));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('uses the checkbox role and aria-checked in multi-choice mode', () => {
    render(
      <AnswerOptionRow label="yes" keyHint={1} selected mode="many" onToggle={() => undefined} />,
    );
    expect(screen.getByRole('checkbox', { name: 'yes' }).getAttribute('aria-checked')).toBe('true');
  });

  it('tags the recommended answer and describes the tile with it', () => {
    render(
      <AnswerOptionRow
        label="sqlite"
        keyHint={1}
        selected={false}
        recommended
        onToggle={() => undefined}
      />,
    );
    const tile = screen.getByRole('radio', { name: 'sqlite' });
    const described = document.getElementById(tile.getAttribute('aria-describedby') ?? '');
    expect(described?.textContent).toBe('Recommended');
  });

  it('ignores clicks once disabled', () => {
    const onToggle = vi.fn();
    render(
      <AnswerOptionRow label="yes" keyHint={1} selected={false} disabled onToggle={onToggle} />,
    );
    fireEvent.click(screen.getByRole('radio', { name: 'yes' }));
    expect(onToggle).not.toHaveBeenCalled();
  });
});
