import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { SessionSignal } from './SessionSignal';

afterEach(cleanup);

describe('SessionSignal', () => {
  it('draws the running glyph alone for one, since the row already says it', () => {
    render(<SessionSignal signal={{ kind: 'running', count: 1 }} />);
    const signal = screen.getByRole('img', { name: '1 agent running' });
    expect(signal.textContent).toBe('');
  });

  it('adds the number from two running agents on', () => {
    render(<SessionSignal signal={{ kind: 'running', count: 3 }} />);
    expect(screen.getByRole('img', { name: '3 agents running' }).textContent).toBe('3');
  });

  it('draws the glyph alone for a compact attention signal with no word', () => {
    render(
      <SessionSignal
        signal={{
          kind: 'attention',
          reason: 'open-question',
          label: '1 question for you',
          word: null,
        }}
      />,
    );
    expect(screen.getByRole('img', { name: '1 question for you' }).textContent).toBe('');
  });

  it('writes the reason in words for a card in the Needs you lane', () => {
    render(
      <SessionSignal
        signal={{
          kind: 'attention',
          reason: 'changes-requested',
          label: 'Changes requested',
          word: 'Changes requested',
        }}
      />,
    );
    const signal = screen.getByRole('img', { name: 'Changes requested' });
    expect(signal.textContent).toBe('Changes requested');
    expect(signal.getAttribute('data-board-signal')).toBe('');
  });
});
