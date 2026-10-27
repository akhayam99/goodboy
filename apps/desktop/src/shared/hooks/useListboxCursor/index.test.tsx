// @vitest-environment happy-dom
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, renderHook } from '@testing-library/react';
import { useListboxCursor } from '.';

const IDS: ReadonlyArray<string> = ['ledger-core', 'notify-relay', 'payments-api'];

type HookParams = {
  readonly ids: ReadonlyArray<string>;
  readonly defaultId?: string | null;
};

const useFixture = ({ ids, defaultId }: HookParams) => {
  const listRef = useRef<HTMLUListElement | null>(null);
  return useListboxCursor({ ids, listRef, listboxId: 'palette', defaultId });
};

describe('useListboxCursor', () => {
  afterEach(() => {
    cleanup();
  });

  it('starts on the first item and names options after the listbox', () => {
    const { result } = renderHook(() => useFixture({ ids: IDS }));

    expect(result.current.activeId).toBe('ledger-core');
    expect(result.current.selectedIndex).toBe(0);
    expect(result.current.optionId({ id: 'notify-relay' })).toBe('palette-notify-relay');
  });

  it('starts on the default item when it is in the list', () => {
    const { result } = renderHook(() => useFixture({ ids: IDS, defaultId: 'payments-api' }));

    expect(result.current.activeId).toBe('payments-api');
    expect(result.current.selectedIndex).toBe(2);
  });

  it('moves one step and stops at both ends', () => {
    const { result } = renderHook(() => useFixture({ ids: IDS }));

    act(() => result.current.move({ delta: -1 }));
    expect(result.current.activeId).toBe('ledger-core');
    act(() => result.current.move({ delta: 1 }));
    act(() => result.current.move({ delta: 1 }));
    act(() => result.current.move({ delta: 1 }));
    expect(result.current.activeId).toBe('payments-api');
  });

  it('selects an item by id and forgets it when selection is cleared', () => {
    const { result } = renderHook(() => useFixture({ ids: IDS }));

    act(() => result.current.select({ id: 'notify-relay' }));
    expect(result.current.selectedIndex).toBe(1);
    act(() => result.current.select({ id: null }));
    expect(result.current.activeId).toBe('ledger-core');
  });

  it('falls back to the first item when the selected one leaves the list', () => {
    const { result, rerender } = renderHook((ids: ReadonlyArray<string>) => useFixture({ ids }), {
      initialProps: IDS,
    });

    act(() => result.current.select({ id: 'notify-relay' }));
    rerender(['ledger-core', 'payments-api']);

    expect(result.current.activeId).toBe('ledger-core');
  });

  it('does nothing when the list is empty', () => {
    const { result } = renderHook(() => useFixture({ ids: [] }));

    act(() => result.current.move({ delta: 1 }));

    expect(result.current.activeId).toBeNull();
  });

  it('scrolls the active option into view', () => {
    const scrollIntoView = vi.fn();
    const Probe = () => {
      const listRef = useRef<HTMLUListElement | null>(null);
      const cursor = useListboxCursor({ ids: IDS, listRef, listboxId: 'palette' });
      return (
        <ul ref={listRef}>
          {IDS.map((id) => (
            <li
              key={id}
              id={cursor.optionId({ id })}
              ref={(node) => {
                if (node !== null) {
                  node.scrollIntoView = scrollIntoView;
                }
              }}
            >
              {id}
            </li>
          ))}
        </ul>
      );
    };

    render(<Probe />);

    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
  });
});
