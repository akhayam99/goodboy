// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { StateNode, type StateNodeSpec } from '.';

afterEach(cleanup);

const IDLE: StateNodeSpec = {
  kind: 'idle',
  state: 'marker',
  mark: { kind: 'glyph', glyph: null },
  tone: 'neutral',
  label: 'Building',
  isSpinning: false,
  hasUnread: false,
};

const NEEDS: StateNodeSpec = {
  ...IDLE,
  kind: 'needs',
  state: 'question',
  tone: 'warning',
  label: 'Needs you',
  hasUnread: true,
};

describe('StateNode', () => {
  it('reserves the slot and draws no ring for an idle row', () => {
    render(<StateNode node={IDLE} hasEmptySlot />);

    expect(screen.getByTestId('state-node-slot').getAttribute('aria-hidden')).toBe('true');
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('keeps the ring of an idle node where the caller asks for no empty slot', () => {
    render(<StateNode node={IDLE} isNamed />);

    expect(screen.queryByTestId('state-node-slot')).toBeNull();
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe('Building');
  });

  it('draws one mark on an unread row and leaves the unread dot to the bold title', () => {
    const { container } = render(<StateNode node={NEEDS} isNamed />);

    expect(screen.getAllByRole('img')).toHaveLength(1);
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe('Needs you');
    expect(container.querySelectorAll('.bg-unread')).toHaveLength(0);
  });

  it('draws the quiet unread dot when the row has no title to embolden', () => {
    const { container } = render(<StateNode node={NEEDS} isNamed isUnreadDot />);

    expect(container.querySelectorAll('.bg-unread')).toHaveLength(1);
  });
});
