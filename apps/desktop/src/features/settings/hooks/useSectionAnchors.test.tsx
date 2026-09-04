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
});
