// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { doorSignalOf } from './doorSignal';

describe('doorSignalOf', () => {
  it('says nothing for the Sessions row when no session needs you', () => {
    expect(doorSignalOf({ kind: 'board', count: 0, reasons: [] })).toBeUndefined();
  });

  it('warns on the Sessions row with the count and every distinct reason', () => {
    expect(
      doorSignalOf({
        kind: 'board',
        count: 2,
        reasons: ['Checks failing', '1 question for you'],
      }),
    ).toEqual({
      count: 2,
      isWarning: true,
      isUnread: false,
      fact: '2 need you: Checks failing, 1 question for you',
    });
  });

  it('says one session needs you in the singular', () => {
    expect(doorSignalOf({ kind: 'board', count: 1, reasons: [] })?.fact).toBe('1 needs you');
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
