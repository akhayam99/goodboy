import { describe, expect, it } from 'vitest';
import type { ResolveQueueRow } from '../../buildResolveQueueRows';
import { threadIdAfterDecision, threadIdAtStep } from './queueTraversal';

const rowOf = (threadId: string): ResolveQueueRow =>
  ({ thread: { threadId } }) as unknown as ResolveQueueRow;

const rows = [rowOf('one'), rowOf('two'), rowOf('three')];

describe('threadIdAtStep', () => {
  it('walks down and up the list as it is shown', () => {
    expect(threadIdAtStep({ rows, selectedThreadId: 'one', delta: 1 })).toBe('two');
    expect(threadIdAtStep({ rows, selectedThreadId: 'three', delta: -1 })).toBe('two');
  });

  it('stops at the ends instead of wrapping around', () => {
    expect(threadIdAtStep({ rows, selectedThreadId: 'three', delta: 1 })).toBeNull();
    expect(threadIdAtStep({ rows, selectedThreadId: 'one', delta: -1 })).toBeNull();
  });

  it('enters the list from the near end when nothing is selected', () => {
    expect(threadIdAtStep({ rows, selectedThreadId: null, delta: 1 })).toBe('one');
    expect(threadIdAtStep({ rows, selectedThreadId: null, delta: -1 })).toBe('three');
  });

  it('enters the list from the near end when the selection left the filter', () => {
    expect(threadIdAtStep({ rows, selectedThreadId: 'gone', delta: 1 })).toBe('one');
  });

  it('has nowhere to go in an empty list', () => {
    expect(threadIdAtStep({ rows: [], selectedThreadId: null, delta: 1 })).toBeNull();
  });
});

describe('threadIdAfterDecision', () => {
  it('hands over the row below the one just decided', () => {
    expect(threadIdAfterDecision({ rows, selectedThreadId: 'two' })).toBe('three');
  });

  it('closes the panel when the decided row was the last one', () => {
    expect(threadIdAfterDecision({ rows, selectedThreadId: 'three' })).toBeNull();
  });
});
