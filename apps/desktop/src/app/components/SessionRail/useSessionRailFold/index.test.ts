import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { STORAGE_KEYS } from '../../../../shared/lib/storage-keys';
import { useSessionRailFold } from './index';

beforeEach(() => {
  localStorage.clear();
});

afterEach(cleanup);

type RenderParams = {
  readonly isNarrow: boolean;
};

const renderFold = ({ isNarrow }: RenderParams) =>
  renderHook((props) => useSessionRailFold(props), { initialProps: { isNarrow } });

describe('useSessionRailFold', () => {
  it('opens by default and remembers a fold', () => {
    const { result } = renderFold({ isNarrow: false });
    expect(result.current.isFolded).toBe(false);

    act(() => {
      result.current.toggle();
    });
    expect(result.current.isFolded).toBe(true);
    expect(localStorage.getItem(STORAGE_KEYS.sessionRailCollapsed)).toBe('1');

    act(() => {
      result.current.toggle();
    });
    expect(result.current.isFolded).toBe(false);
    expect(localStorage.getItem(STORAGE_KEYS.sessionRailCollapsed)).toBe('0');
  });

  it('reads a saved fold on mount', () => {
    localStorage.setItem(STORAGE_KEYS.sessionRailCollapsed, '1');
    expect(renderFold({ isNarrow: false }).result.current.isFolded).toBe(true);
  });

  it('folds by itself while narrow, opens on toggle, and forgets that once wide again', () => {
    const { result, rerender } = renderFold({ isNarrow: true });
    expect(result.current.isFolded).toBe(true);

    act(() => {
      result.current.toggle();
    });
    expect(result.current.isFolded).toBe(false);

    rerender({ isNarrow: false });
    rerender({ isNarrow: true });
    expect(result.current.isFolded).toBe(true);
    expect(localStorage.getItem(STORAGE_KEYS.sessionRailCollapsed)).toBe('0');
  });
});
