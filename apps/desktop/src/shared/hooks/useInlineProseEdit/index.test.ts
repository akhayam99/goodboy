import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useInlineProseEdit } from './index';

describe('useInlineProseEdit', () => {
  it('refuses to edit without a commit handler', () => {
    const { result } = renderHook(() => useInlineProseEdit({ value: 'body' }));

    act(() => result.current.start());

    expect(result.current.canEdit).toBe(false);
    expect(result.current.isEditing).toBe(false);
  });

  it('keeps the draft after a cancel and drops it when the source changes', () => {
    const onCommit = vi.fn(async () => {});
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useInlineProseEdit({ value, onCommit }),
      { initialProps: { value: 'body' } },
    );

    act(() => result.current.start());
    act(() => result.current.setDraft('edited body'));
    act(() => result.current.cancel());

    expect(result.current.isEditing).toBe(false);
    expect(result.current.draft).toBe('edited body');
    expect(result.current.isDirty).toBe(true);

    rerender({ value: 'body from the provider' });

    expect(result.current.draft).toBe('body from the provider');
    expect(result.current.isDirty).toBe(false);
  });

  it('reports the failure and keeps the draft when the commit throws', async () => {
    const onCommit = vi.fn(async () => {
      throw new Error('write rejected');
    });
    const { result } = renderHook(() => useInlineProseEdit({ value: 'body', onCommit }));

    act(() => result.current.start());
    act(() => result.current.setDraft('edited body'));
    await act(() => result.current.commit());

    expect(result.current.error).toContain('write rejected');
    expect(result.current.draft).toBe('edited body');
    expect(result.current.isEditing).toBe(true);
  });
});
