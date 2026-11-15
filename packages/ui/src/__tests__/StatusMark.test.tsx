// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { StatusMark } from '../components/StatusMark';
import {
  STATUS_MARK_DRAWING,
  type StatusMarkSpec,
  type StatusMarkState,
} from '../components/StatusMark/statusMarkSpec';

afterEach(cleanup);

const STATES: ReadonlyArray<StatusMarkState> = [
  'running',
  'merging',
  'queued',
  'question',
  'approval',
  'budget',
  'alert',
  'ready',
  'failed',
  'done',
  'merged',
  'approved',
  'closed',
  'stopped',
  'skipped',
];

const SPECS: ReadonlyArray<StatusMarkSpec> = [
  ...STATES.map((state): StatusMarkSpec => ({ kind: 'state', state })),
  { kind: 'dot', tone: 'unread' },
  { kind: 'count', tone: 'warning', text: '9+' },
  { kind: 'empty' },
];

describe('StatusMark', () => {
  it.each(SPECS)('draws %o in the one 16px box, centred', (mark) => {
    const { container } = render(<StatusMark mark={mark} />);
    const box = container.querySelector('[data-status-mark]');
    expect(box?.className).toContain('size-4');
    expect(box?.className).toContain('items-center');
    expect(box?.className).toContain('justify-center');
    expect(box?.getAttribute('aria-hidden')).toBe('true');
  });

  it('never nests a glyph in a second ring', () => {
    for (const state of STATES) {
      const { container, unmount } = render(<StatusMark mark={{ kind: 'state', state }} />);
      const box = container.querySelector('[data-status-mark]');
      expect(box?.children.length).toBe(1);
      expect(box?.querySelectorAll('svg').length).toBeLessThanOrEqual(1);
      unmount();
    }
  });

  it('turns only the rings that mean progress', () => {
    const { container, rerender } = render(
      <StatusMark mark={{ kind: 'state', state: 'running' }} />,
    );
    expect(container.querySelector('.spin-border')).not.toBeNull();
    expect(container.querySelector('[data-status-family="ring"]')).not.toBeNull();
    rerender(<StatusMark mark={{ kind: 'state', state: 'approval' }} />);
    expect(container.querySelector('.spin-border')).toBeNull();
    expect(container.querySelector('[data-status-family="ask"]')).not.toBeNull();
  });

  it('lists every state it draws', () => {
    expect([...STATES].sort()).toEqual(Object.keys(STATUS_MARK_DRAWING).sort());
  });

  it('names itself only when given a label', () => {
    render(<StatusMark mark={{ kind: 'state', state: 'question' }} label="Needs you" />);
    expect(screen.getByRole('img', { name: 'Needs you' }).getAttribute('data-status-state')).toBe(
      'question',
    );
  });

  it('draws a count as the number alone, in its tone, without a dot', () => {
    const { container } = render(
      <StatusMark mark={{ kind: 'count', tone: 'warning', text: '3' }} />,
    );
    const box = container.querySelector('[data-status-mark="count"]');
    expect(box?.textContent).toBe('3');
    expect(box?.querySelector('.rounded-full')).toBeNull();
    expect(box?.innerHTML).toContain('text-warning');
  });
});
