// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { DoorSignalMark } from './DoorSignalMark';
import type { DoorSignal } from './doorSignal';

afterEach(cleanup);

const mark = (signal: DoorSignal) => render(<DoorSignalMark signal={signal} />).container;

describe('DoorSignalMark', () => {
  it('draws a small amber dot and a muted number when sessions need you', () => {
    const count = mark({
      count: 3,
      isWarning: true,
      isUnread: false,
      tone: 'warning',
      countText: '3',
      fact: '3 need you',
    }).querySelector('[data-door-count]');

    expect(count?.textContent).toBe('3');
    expect(count?.getAttribute('data-door-signal')).toBe('warning');
    expect(count?.querySelectorAll('[aria-hidden]')).toHaveLength(1);
  });

  it('draws the dot red, and the number still muted, when something is broken', () => {
    const count = mark({
      count: 9,
      isWarning: true,
      isUnread: false,
      tone: 'danger',
      countText: '9+',
      fact: '12 need you',
    }).querySelector('[data-door-count]');

    expect(count?.textContent).toBe('9+');
    expect(count?.getAttribute('data-door-signal')).toBe('danger');
  });

  it('draws the number for one session too, with its dot and no pill', () => {
    const one = mark({
      count: 1,
      isWarning: true,
      isUnread: false,
      tone: 'warning',
      countText: '1',
      fact: 'x',
    });

    expect(one.querySelector('[data-door-count]')?.textContent).toBe('1');
    expect(one.querySelector('[data-door-pill]')).toBeNull();
  });

  it('draws a quiet neutral dot, never amber, when only replies and approvals wait', () => {
    const quiet = mark({ count: 0, isWarning: false, isUnread: false, tone: 'neutral', fact: 'x' });

    expect(quiet.querySelector('[data-door-signal="neutral"]')).not.toBeNull();
    expect(quiet.querySelector('.bg-warning')).toBeNull();
    expect(quiet.querySelector('[data-door-count]')).toBeNull();
  });

  it('keeps the warning dot of a pinned port that is down, with no number', () => {
    const port = mark({ count: 3, isWarning: true, isUnread: false, fact: 'pinned port is down' });

    expect(port.querySelector('[data-door-signal="warning"]')).not.toBeNull();
    expect(port.querySelector('[data-door-count]')).toBeNull();
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
