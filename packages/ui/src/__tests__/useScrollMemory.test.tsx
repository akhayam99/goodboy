// @vitest-environment happy-dom

import { createRef, type RefObject } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { forgetScrollMemory } from '../forgetScrollMemory';
import { recalledScroll } from '../recalledScroll';
import { rememberScroll } from '../rememberScroll';
import { SCROLL_MEMORY, SCROLL_MEMORY_CAP } from '../scrollMemoryStore';
import { useScrollMemory } from '../useScrollMemory';

type HookProps = {
  readonly memoryKey: string;
  readonly isLoaded: boolean;
};

const viewportOf = (): RefObject<HTMLElement | null> => {
  const ref = createRef<HTMLElement>();
  const element = document.createElement('div');
  Object.assign(ref, { current: element });
  return ref;
};

beforeEach(() => {
  SCROLL_MEMORY.clear();
});

afterEach(() => {
  SCROLL_MEMORY.clear();
});

describe('useScrollMemory', () => {
  it('does not restore into the short skeleton and restores once the data is loaded', () => {
    rememberScroll({ memoryKey: 'harborline|branch', top: 480 });
    const viewportRef = viewportOf();
    const { rerender } = renderHook(
      (props: HookProps) => useScrollMemory({ ...props, viewportRef }),
      { initialProps: { memoryKey: 'harborline|branch', isLoaded: false } },
    );
    expect(viewportRef.current?.scrollTop).toBe(0);

    rerender({ memoryKey: 'harborline|branch', isLoaded: true });

    expect(viewportRef.current?.scrollTop).toBe(480);
  });

  it('remembers the offset after the restore and keeps one per key', () => {
    const viewportRef = viewportOf();
    const { result, rerender } = renderHook(
      (props: HookProps) => useScrollMemory({ ...props, viewportRef }),
      { initialProps: { memoryKey: 'northwind|overview', isLoaded: true } },
    );
    const viewport = viewportRef.current;
    if (viewport === null) {
      throw new Error('no viewport');
    }

    viewport.scrollTop = 120;
    result.current();
    rerender({ memoryKey: 'cascadia|overview', isLoaded: true });
    viewport.scrollTop = 40;
    result.current();

    expect(recalledScroll({ memoryKey: 'northwind|overview' })).toBe(120);
    expect(recalledScroll({ memoryKey: 'cascadia|overview' })).toBe(40);
  });

  it('writes nothing before the restore has run', () => {
    const viewportRef = viewportOf();
    const { result } = renderHook(
      (props: HookProps) => useScrollMemory({ ...props, viewportRef }),
      { initialProps: { memoryKey: 'acme|overview', isLoaded: false } },
    );

    result.current();

    expect(recalledScroll({ memoryKey: 'acme|overview' })).toBeNull();
  });
});

describe('scroll memory store', () => {
  it('keeps the 50 most recent keys', () => {
    for (let index = 0; index < SCROLL_MEMORY_CAP + 5; index += 1) {
      rememberScroll({ memoryKey: `session-${index}|overview`, top: index });
    }

    expect(SCROLL_MEMORY.size).toBe(SCROLL_MEMORY_CAP);
    expect(recalledScroll({ memoryKey: 'session-0|overview' })).toBeNull();
    expect(recalledScroll({ memoryKey: `session-${SCROLL_MEMORY_CAP + 4}|overview` })).toBe(
      SCROLL_MEMORY_CAP + 4,
    );
  });

  it('forgets every key of a deleted session and no other', () => {
    rememberScroll({ memoryKey: 'payments-api|overview', top: 10 });
    rememberScroll({ memoryKey: 'payments-api|branch', top: 20 });
    rememberScroll({ memoryKey: 'ledger-core|overview', top: 30 });

    forgetScrollMemory({ scopeId: 'payments-api' });

    expect(recalledScroll({ memoryKey: 'payments-api|overview' })).toBeNull();
    expect(recalledScroll({ memoryKey: 'payments-api|branch' })).toBeNull();
    expect(recalledScroll({ memoryKey: 'ledger-core|overview' })).toBe(30);
  });
});
