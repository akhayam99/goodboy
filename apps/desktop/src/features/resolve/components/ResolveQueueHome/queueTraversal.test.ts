import { describe, expect, it } from 'vitest';
import type { ResolveQueueRow } from '../../buildResolveQueueRows';
import { threadIdAfterDecision, threadIdAtStep } from './queueTraversal';

const rowOf = ({ threadId }: { readonly threadId: string }): ResolveQueueRow =>
  ({ thread: { threadId } }) as unknown as ResolveQueueRow;

const rows = [rowOf({ threadId: 'one' }), rowOf({ threadId: 'two' }), rowOf({ threadId: 'three' })];

describe('threadIdAtStep', () => {
  it('walks down and up the list as it is shown', () => {
    expect(threadIdAtStep({ rows, selectedThreadId: 'one', delta: 1 })).toBe('two');
    expect(threadIdAtStep({ rows, selectedThreadId: 'three', delta: -1 })).toBe('two');
  });

  it('stops at the ends instead of wrapping around', () => {
    expect(threadIdAtStep({ rows, selectedThreadId: 'three', delta: 1 })).toBeNull();
    expect(threadIdAtStep({ rows, selectedThreadId: 'one', delta: -1 })).toBeNull();
  });

  it('stays put rather than entering the list when nothing is selected', () => {
    expect(threadIdAtStep({ rows, selectedThreadId: null, delta: 1 })).toBeNull();
    expect(threadIdAtStep({ rows, selectedThreadId: null, delta: -1 })).toBeNull();
  });

  it('stays put rather than jumping to the top when the row is not in the list', () => {
    expect(threadIdAtStep({ rows, selectedThreadId: 'parked', delta: 1 })).toBeNull();
    expect(threadIdAtStep({ rows, selectedThreadId: 'parked', delta: -1 })).toBeNull();
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

  it('closes the panel rather than jumping to the top when the row is not listed', () => {
    expect(threadIdAfterDecision({ rows, selectedThreadId: 'parked' })).toBeNull();
    expect(threadIdAfterDecision({ rows, selectedThreadId: null })).toBeNull();
  });
});
