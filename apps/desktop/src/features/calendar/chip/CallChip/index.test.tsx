// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CallChip } from '.';
import type { ChipView } from '../callChipTypes';
import { chipExpiryOf } from '../chipExpiryOf';

afterEach(cleanup);

const START = new Date(2026, 10, 27, 10, 30).getTime();
const END = START + 30 * 60_000;

const SOON: ChipView = {
  kind: 'soon',
  title: 'Northwind sync: payments-api rollout',
  start: START,
  host: 'meet.google.com',
  rows: [
    {
      key: 'session-1',
      text: 'notify-relay · 1 question for you',
      mark: { kind: 'state', state: 'question' },
      canOpen: true,
    },
  ],
};

const COUNTDOWN: ChipView = {
  kind: 'countdown',
  title: 'Northwind sync',
  start: START,
  end: END,
  host: 'meet.google.com',
  people: ['Mara Acme'],
};

type RenderParams = {
  readonly view: ChipView;
  readonly now?: number;
  readonly hasFailed?: boolean;
};

const renderChip = ({ view, now = START - 42_000, hasFailed = false }: RenderParams) => {
  const onAct = vi.fn();
  render(<CallChip view={view} now={now} hasFailed={hasFailed} onAct={onAct} />);
  return onAct;
};

describe('CallChip', () => {
  it('shows the call and who waits five minutes before, with Join call and Open per owner', () => {
    const onAct = renderChip({ view: SOON });
    screen.getByText('Before the call · 1 need you');
    fireEvent.click(screen.getByRole('button', { name: 'Open notify-relay · 1 question for you' }));
    expect(onAct).toHaveBeenLastCalledWith({ action: { kind: 'open', rowKey: 'session-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Join call' }));
    expect(onAct).toHaveBeenLastCalledWith({ action: { kind: 'join' } });
    expect(screen.queryByRole('button', { name: 'Remind me in 5m' })).toBeNull();
  });

  it('counts down one minute before and offers Remind me in 5m and Hide', () => {
    const onAct = renderChip({ view: COUNTDOWN });
    screen.getByText('in 42s');
    fireEvent.click(screen.getByRole('button', { name: 'Remind me in 5m' }));
    expect(onAct).toHaveBeenLastCalledWith({ action: { kind: 'snooze' } });
    fireEvent.click(screen.getByRole('button', { name: 'Hide' }));
    expect(onAct).toHaveBeenLastCalledWith({ action: { kind: 'hide' } });
  });

  it('offers Return to call while in the call and never Join call', () => {
    const onAct = renderChip({
      view: { kind: 'in-call', title: 'Northwind sync', end: END, joinedAt: START, heldCount: 2 },
      now: START + 192_000,
    });
    screen.getByText('3m 12s');
    expect(screen.queryByRole('button', { name: 'Join call' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Return to call' }));
    expect(onAct).toHaveBeenLastCalledWith({ action: { kind: 'return' } });
  });

  it("says when Goodboy didn't answer a click, without the raw error", () => {
    renderChip({ view: COUNTDOWN, hasFailed: true });
    expect(screen.getByRole('alert').textContent).toBe("Goodboy didn't answer. Try again.");
  });
});

describe('chipExpiryOf', () => {
  it('hides a snooze note after a moment and a countdown ten minutes after the start', () => {
    expect(chipExpiryOf({ view: { kind: 'snoozed', start: START, until: END }, shownAt: 0 })).toBe(
      4_000,
    );
    expect(chipExpiryOf({ view: COUNTDOWN, shownAt: 0 })).toBe(START + 10 * 60_000);
    expect(chipExpiryOf({ view: SOON, shownAt: 0 })).toBeNull();
  });
});
