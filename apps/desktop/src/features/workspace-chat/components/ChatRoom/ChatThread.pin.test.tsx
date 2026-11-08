// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { installFakeResizeObserver } from '../../../../test/fakeResizeObserver';
import { ChatThread } from './ChatThread';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('ChatThread', () => {
  it('stays on the last message when the thread shrinks while pinned at the bottom', () => {
    const observers = installFakeResizeObserver();
    const view = render(
      <ChatThread
        messages={[]}
        workspaceName="Harborline"
        sessions={[]}
        onOpenSession={() => undefined}
      />,
    );
    const viewport = view.container.firstElementChild?.firstElementChild;
    if (!(viewport instanceof HTMLElement)) {
      throw new Error('missing the thread viewport');
    }
    Object.defineProperty(viewport, 'scrollHeight', { configurable: true, value: 900 });
    viewport.scrollTop = 0;

    act(() => observers.resizeAll());

    expect(viewport.scrollTop).toBe(900);
  });
});
