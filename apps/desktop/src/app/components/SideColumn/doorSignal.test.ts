// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { doorSignalOf } from './doorSignal';

const NONE = { quietCount: 0, quietReasons: [] } as const;

describe('doorSignalOf inbox', () => {
  it('says nothing for Tasks when nothing arrived', () => {
    expect(doorSignalOf({ kind: 'inbox', count: 0 })).toBeUndefined();
  });

  it('draws the quiet unread dot with the count in its fact, never a warning', () => {
    expect(doorSignalOf({ kind: 'inbox', count: 3 })).toEqual({
      count: 3,
      isWarning: false,
      isUnread: true,
      fact: '3 new',
    });
  });
});

describe('doorSignalOf', () => {
  it('says nothing for the Sessions row when no session needs you', () => {
    expect(
      doorSignalOf({ kind: 'board', count: 0, tone: null, reasons: [], ...NONE }),
    ).toBeUndefined();
  });

  it('warns on the Sessions row with the count and every distinct reason', () => {
    expect(
      doorSignalOf({
        kind: 'board',
        count: 2,
        tone: 'warning',
        reasons: ['Checks failing', '1 question for you'],
        ...NONE,
      }),
    ).toEqual({
      count: 2,
      isWarning: true,
      isUnread: false,
      tone: 'warning',
      countText: '2',
      fact: '2 need you: Checks failing, 1 question for you',
    });
  });

  it('says one session needs you in the singular, with the count 1 beside the dot', () => {
    const signal = doorSignalOf({ kind: 'board', count: 1, tone: 'warning', reasons: [], ...NONE });

    expect(signal?.fact).toBe('1 needs you');
    expect(signal?.countText).toBe('1');
  });

  it('turns red when a session in the count is broken', () => {
    expect(
      doorSignalOf({ kind: 'board', count: 1, tone: 'danger', reasons: [], ...NONE })?.tone,
    ).toBe('danger');
    expect(
      doorSignalOf({ kind: 'board', count: 4, tone: 'danger', reasons: [], ...NONE })?.countText,
    ).toBe('4');
  });

  it('caps the number at 9+', () => {
    expect(
      doorSignalOf({ kind: 'board', count: 9, tone: 'warning', reasons: [], ...NONE })?.countText,
    ).toBe('9');
    expect(
      doorSignalOf({ kind: 'board', count: 10, tone: 'warning', reasons: [], ...NONE })?.countText,
    ).toBe('9+');
    expect(
      doorSignalOf({ kind: 'board', count: 31, tone: 'warning', reasons: [], ...NONE })?.fact,
    ).toBe('31 need you');
  });

  it('draws a quiet neutral dot, never a number, when only replies and approvals wait', () => {
    expect(
      doorSignalOf({
        kind: 'board',
        count: 0,
        tone: null,
        reasons: [],
        quietCount: 2,
        quietReasons: ['New reply', 'Approved, ready to merge'],
      }),
    ).toEqual({
      count: 0,
      isWarning: false,
      isUnread: false,
      tone: 'neutral',
      fact: '2 to look at: New reply, Approved, ready to merge',
    });
  });

  it('counts the loud ones and leaves the quiet ones to the tooltip of the loud count', () => {
    const signal = doorSignalOf({
      kind: 'board',
      count: 1,
      tone: 'warning',
      reasons: ['1 question for you'],
      quietCount: 3,
      quietReasons: ['New reply'],
    });

    expect(signal).toMatchObject({ count: 1, isWarning: true, tone: 'warning' });
    expect(signal?.countText).toBe('1');
  });

  it('says nothing for a terminal row with no live terminal', () => {
    expect(doorSignalOf({ kind: 'terminal', count: 0 })).toBeUndefined();
  });

  it('counts the live terminals', () => {
    expect(doorSignalOf({ kind: 'terminal', count: 2 })).toEqual({
      count: 2,
      isWarning: false,
      isUnread: false,
      fact: '2 running',
    });
  });

  it('says nothing for a monitoring row with no port in use and no pin down', () => {
    expect(doorSignalOf({ kind: 'monitoring', inUse: 0, downPins: [] })).toBeUndefined();
  });

  it('counts the ports in use', () => {
    expect(doorSignalOf({ kind: 'monitoring', inUse: 3, downPins: [] })).toEqual({
      count: 3,
      isWarning: false,
      isUnread: false,
      fact: '3 in use',
    });
  });

  it('prefers the warning over the count when a pinned port is down', () => {
    expect(doorSignalOf({ kind: 'monitoring', inUse: 3, downPins: [9000] })).toEqual({
      count: 3,
      isWarning: true,
      isUnread: false,
      fact: 'pinned port :9000 is down',
    });
    expect(doorSignalOf({ kind: 'monitoring', inUse: 0, downPins: [9000] })?.isWarning).toBe(true);
  });

  it('names every pinned port that is down', () => {
    expect(doorSignalOf({ kind: 'monitoring', inUse: 0, downPins: [5173, 9000] })?.fact).toBe(
      'pinned ports :5173, :9000 are down',
    );
  });

  it('counts the running chats and shows a dot only for unread with none running', () => {
    expect(doorSignalOf({ kind: 'chat', count: 0, hasUnread: false })).toBeUndefined();
    expect(doorSignalOf({ kind: 'chat', count: 2, hasUnread: true })).toEqual({
      count: 2,
      isWarning: false,
      isUnread: false,
      fact: '2 running',
    });
    expect(doorSignalOf({ kind: 'chat', count: 0, hasUnread: true })).toEqual({
      count: 0,
      isWarning: false,
      isUnread: true,
      fact: 'unread',
    });
  });
});
