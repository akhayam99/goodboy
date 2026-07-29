import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useCommitLinkInterceptor } from './index';
import { openUrl } from '../../lib/editor';

vi.mock('../../lib/editor', () => ({ openUrl: vi.fn() }));

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
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('useCommitLinkInterceptor', () => {
  it('captures a github commit link into commitDiff', () => {
    const { result } = renderHook(() => useCommitLinkInterceptor());
    clickAnchor('https://github.com/owner/repo/commit/abc1234');
    expect(result.current.commitDiff).toEqual({ repo: 'owner/repo', sha: 'abc1234' });
    expect(openUrl).not.toHaveBeenCalled();
  });

  it('opens a non-commit external link without setting commitDiff', () => {
    const { result } = renderHook(() => useCommitLinkInterceptor());
    clickAnchor('https://example.com/docs');
    expect(result.current.commitDiff).toBeNull();
    expect(openUrl).toHaveBeenCalledWith('https://example.com/docs');
  });

  it('ignores modifier-clicks so the OS can handle them', () => {
    const { result } = renderHook(() => useCommitLinkInterceptor());
    clickAnchor('https://github.com/owner/repo/commit/abc1234', { metaKey: true });
    expect(result.current.commitDiff).toBeNull();
    expect(openUrl).not.toHaveBeenCalled();
  });

  it('opens a commit on request, carrying the file to jump to', () => {
    const { result } = renderHook(() => useCommitLinkInterceptor());
    act(() => {
      window.dispatchEvent(
        new CustomEvent('goodboy:open-commit-diff', {
          detail: { repo: 'owner/repo', sha: 'abc1234', file: 'src/a.ts' },
        }),
      );
    });
    expect(result.current.commitDiff).toEqual({
      repo: 'owner/repo',
      sha: 'abc1234',
      file: 'src/a.ts',
    });
  });

  it('ignores an open request without a sha', () => {
    const { result } = renderHook(() => useCommitLinkInterceptor());
    act(() => {
      window.dispatchEvent(
        new CustomEvent('goodboy:open-commit-diff', { detail: { repo: 'owner/repo' } }),
      );
    });
    expect(result.current.commitDiff).toBeNull();
  });

  it('ignores clicks on anchors without an href', () => {
    const { result } = renderHook(() => useCommitLinkInterceptor());
    clickAnchor(null);
    expect(result.current.commitDiff).toBeNull();
    expect(openUrl).not.toHaveBeenCalled();
  });
});
