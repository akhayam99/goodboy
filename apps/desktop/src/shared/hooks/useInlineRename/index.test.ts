// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useInlineRename } from './index';

afterEach(cleanup);

describe('useInlineRename', () => {
  it('resolves the row when blurring with an empty draft', () => {
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    const { result } = renderHook(() =>
      useInlineRename({ value: 'agent one', isEditing: true, onCommit, onCancel }),
    );

    act(() => {
      result.current.setDraft('   ');
    });
    act(() => {
      result.current.onBlur();
    });

    expect(onCommit).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('does not clobber an in-progress draft when the value changes mid-edit', () => {
    const onCommit = vi.fn();
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useInlineRename({ value, isEditing: true, onCommit }),
      { initialProps: { value: 'agent one' } },
    );

    act(() => {
      result.current.setDraft('agent one (typing…)');
    });

    rerender({ value: 'agent one (auto-retitled)' });

    expect(result.current.draft).toBe('agent one (typing…)');
  });
});
