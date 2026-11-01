import { describe, expect, it } from 'vitest';
import { openThreadsLineOf } from './openThreadsLineOf';

describe('openThreadsLineOf', () => {
  it('reads nothing when no thread is open', () => {
    expect(openThreadsLineOf({ unresolved: 0, unreadCount: 0, needYou: 0 })).toBeNull();
  });

  it('says how many are open and how many need you', () => {
    expect(openThreadsLineOf({ unresolved: 6, unreadCount: 0, needYou: 2 })).toBe(
      '6 open threads · 2 need you',
    );
    expect(openThreadsLineOf({ unresolved: 1, unreadCount: 0, needYou: 1 })).toBe(
      '1 open thread · 1 needs you',
    );
    expect(openThreadsLineOf({ unresolved: 3, unreadCount: 0, needYou: 0 })).toBe('3 open threads');
  });

  it('puts the ones that need you before the unread ones and drops each part at zero', () => {
    expect(openThreadsLineOf({ unresolved: 6, unreadCount: 2, needYou: 1 })).toBe(
      '6 open threads · 1 needs you · 2 unread',
    );
    expect(openThreadsLineOf({ unresolved: 6, unreadCount: 2, needYou: 0 })).toBe(
      '6 open threads · 2 unread',
    );
  });
});
