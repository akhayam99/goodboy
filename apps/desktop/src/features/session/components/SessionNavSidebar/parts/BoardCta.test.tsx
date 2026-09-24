// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { shortcutGlyphs } from '../../../../../shared/keyboard/registry';
import { BoardCta } from './BoardCta';

afterEach(cleanup);

const label = () => `Back to board (${shortcutGlyphs('session.board')})`;

describe('BoardCta', () => {
  it('reads as a neutral navigation row at rest', () => {
    render(<BoardCta onNavigate={vi.fn()} />);

    const row = screen.getByRole('button', { name: label() });

    expect(row.className).toContain('text-muted-foreground');
    expect(row.className).not.toMatch(/(^|\s)(bg|text|ring)-primary/);
  });

  it('goes back to the board on click', () => {
    const onNavigate = vi.fn();
    render(<BoardCta onNavigate={onNavigate} />);

    fireEvent.click(screen.getByRole('button', { name: label() }));

    expect(onNavigate).toHaveBeenCalledOnce();
  });
});
