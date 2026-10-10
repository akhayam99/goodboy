// @vitest-environment happy-dom

import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { focusComposerTextarea } from './focusComposerTextarea';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('focusComposerTextarea', () => {
  it('focuses the textarea without scrolling an ancestor', () => {
    const wrapperRef = createRef<HTMLDivElement>();
    render(
      <div ref={wrapperRef}>
        <textarea aria-label="Message" />
      </div>,
    );
    const focus = vi.spyOn(HTMLTextAreaElement.prototype, 'focus');

    focusComposerTextarea(wrapperRef);

    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it('does nothing while the wrapper is not mounted', () => {
    const focus = vi.spyOn(HTMLTextAreaElement.prototype, 'focus');

    focusComposerTextarea(createRef<HTMLDivElement>());

    expect(focus).not.toHaveBeenCalled();
  });
});
