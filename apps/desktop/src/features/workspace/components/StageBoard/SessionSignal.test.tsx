import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { SessionSignal } from './SessionSignal';

afterEach(cleanup);

describe('SessionSignal', () => {
  it.each([
    ['question', '1 open question'],
    ['running', '1 agent running'],
  ] as const)('draws the %s glyph alone for one, since the row already says it', (kind, label) => {
    render(<SessionSignal signal={{ kind, count: 1 }} />);
    const signal = screen.getByRole('img', { name: label });
    expect(signal.textContent).toBe('');
  });

  it.each([
    ['question', '3 open questions'],
    ['running', '3 agents running'],
  ] as const)('adds the number from two %s on', (kind, label) => {
    render(<SessionSignal signal={{ kind, count: 3 }} />);
    expect(screen.getByRole('img', { name: label }).textContent).toBe('3');
  });
});
