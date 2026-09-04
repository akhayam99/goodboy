// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useSectionAnchors } from './useSectionAnchors';

const scrollIntoView = vi.fn();

beforeEach(() => scrollIntoView.mockReset());

describe('useSectionAnchors', () => {
  it('scrolls the selected registered section to the start', () => {
    const element = document.createElement('section');
    element.scrollIntoView = scrollIntoView;
    const { result, rerender } = renderHook(
      ({ section }: { readonly section?: string }) => useSectionAnchors({ section }),
      { initialProps: { section: undefined as string | undefined } },
    );

    act(() => result.current.anchor({ id: 'projects' })(element));
    rerender({ section: 'projects' });

    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start' });
  });

  it('scrolls a section that mounts after the deep link was requested', () => {
    const element = document.createElement('section');
    element.scrollIntoView = scrollIntoView;
    const { result } = renderHook(() => useSectionAnchors({ section: 'projects' }));

    expect(scrollIntoView).not.toHaveBeenCalled();

    act(() => result.current.anchor({ id: 'projects' })(element));

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start' });
  });

  it('does not scroll an unrelated section that mounts later', () => {
    const element = document.createElement('section');
    element.scrollIntoView = scrollIntoView;
    const { result } = renderHook(() => useSectionAnchors({ section: 'projects' }));

    act(() => result.current.anchor({ id: 'danger' })(element));

    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});
