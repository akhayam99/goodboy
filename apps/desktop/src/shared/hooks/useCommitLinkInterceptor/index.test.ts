import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCommitLinkInterceptor } from './index';

const opened = vi.fn<(event: Event) => void>();

beforeEach(() => {
  window.addEventListener('goodboy:open-link', opened);
});

const clickAnchor = (href: string | null, init: MouseEventInit = {}) => {
  const anchor = document.createElement('a');
  if (href !== null) {
    anchor.setAttribute('href', href);
  }
  anchor.textContent = 'link';
  document.body.appendChild(anchor);
  act(() => {
    anchor.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init }),
    );
  });
};

afterEach(() => {
  cleanup();
  window.removeEventListener('goodboy:open-link', opened);
  opened.mockClear();
  document.body.innerHTML = '';
});

describe('useCommitLinkInterceptor', () => {
  it('captures a github commit link into commitDiff', () => {
    const { result } = renderHook(() => useCommitLinkInterceptor());
    clickAnchor('https://github.com/owner/repo/commit/abc1234');
    expect(result.current.commitDiff).toEqual({ repo: 'owner/repo', sha: 'abc1234' });
    expect(opened).not.toHaveBeenCalled();
  });

  it('asks the open router for a non-commit external link without setting commitDiff', () => {
    const { result } = renderHook(() => useCommitLinkInterceptor());
    clickAnchor('https://example.com/docs');
    expect(result.current.commitDiff).toBeNull();
    const event = opened.mock.calls[0]?.[0];
    expect(event instanceof CustomEvent ? event.detail : null).toEqual({
      url: 'https://example.com/docs',
    });
  });

  it('leaves a mailto link alone, since the backend refuses it', () => {
    renderHook(() => useCommitLinkInterceptor());
    clickAnchor('mailto:team@northwind.example');
    expect(opened).not.toHaveBeenCalled();
  });

  it('ignores modifier-clicks so the OS can handle them', () => {
    const { result } = renderHook(() => useCommitLinkInterceptor());
    clickAnchor('https://github.com/owner/repo/commit/abc1234', { metaKey: true });
    expect(result.current.commitDiff).toBeNull();
    expect(opened).not.toHaveBeenCalled();
  });

  it('ignores clicks on anchors without an href', () => {
    const { result } = renderHook(() => useCommitLinkInterceptor());
    clickAnchor(null);
    expect(result.current.commitDiff).toBeNull();
    expect(opened).not.toHaveBeenCalled();
  });
});
