// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { DoorSignalMark } from './DoorSignalMark';
import type { DoorSignal } from './doorSignal';

afterEach(cleanup);

const mark = (signal: DoorSignal) => render(<DoorSignalMark signal={signal} />).container;

describe('DoorSignalMark', () => {
  it('draws a number in an amber pill when two or more need you', () => {
    const pill = mark({
      count: 3,
      isWarning: true,
      isUnread: false,
      tone: 'warning',
      pill: '3',
      fact: '3 need you',
    }).querySelector('[data-door-pill]');

    expect(pill?.textContent).toBe('3');
    expect(pill?.getAttribute('data-door-signal')).toBe('warning');
  });

  it('draws the pill red when something is broken', () => {
    const pill = mark({
      count: 9,
      isWarning: true,
      isUnread: false,
      tone: 'danger',
      pill: '9+',
      fact: '12 need you',
    }).querySelector('[data-door-pill]');

    expect(pill?.textContent).toBe('9+');
    expect(pill?.getAttribute('data-door-signal')).toBe('danger');
  });

  it('keeps the dot for one session, in the tone of its reason', () => {
    const amber = mark({ count: 1, isWarning: true, isUnread: false, tone: 'warning', fact: 'x' });
    const red = mark({ count: 1, isWarning: true, isUnread: false, tone: 'danger', fact: 'x' });

    expect(amber.querySelector('[data-door-signal="warning"] .bg-warning')).not.toBeNull();
    expect(amber.querySelector('[data-door-pill]')).toBeNull();
    expect(red.querySelector('[data-door-signal="danger"] .bg-danger')).not.toBeNull();
  });

  it('draws a quiet neutral dot, never amber, when only replies and approvals wait', () => {
    const quiet = mark({ count: 0, isWarning: false, isUnread: false, tone: 'neutral', fact: 'x' });

    expect(quiet.querySelector('[data-door-signal="neutral"]')).not.toBeNull();
    expect(quiet.querySelector('.bg-warning')).toBeNull();
    expect(quiet.querySelector('[data-door-pill]')).toBeNull();
  });

  it('keeps the warning dot of a pinned port that is down, with no number', () => {
    const port = mark({ count: 3, isWarning: true, isUnread: false, fact: 'pinned port is down' });

    expect(port.querySelector('[data-door-signal="warning"]')).not.toBeNull();
    expect(port.querySelector('[data-door-pill]')).toBeNull();
  });

  it('keeps the primary dot for an unread chat', () => {
    const unread = mark({ count: 0, isWarning: false, isUnread: true, fact: 'unread' });

    expect(unread.querySelector('[data-door-signal="unread"]')).not.toBeNull();
  });

  it('draws nothing for a plain count of running things', () => {
    const running = mark({ count: 2, isWarning: false, isUnread: false, fact: '2 running' });

    expect(running.textContent).toBe('');
    expect(running.querySelector('[data-door-signal]')).toBeNull();
  });
});
