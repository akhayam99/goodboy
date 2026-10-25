import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  importStore,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
  stubStoryInvoke,
  type StoryStore,
} from '../../../store/storyHarness';
import { useCommitLinkInterceptor } from './index';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../store/storyHarness')).dbModuleMock());

let useAppStore: StoryStore;
const openUrl = vi.fn(async (_args: unknown): Promise<unknown> => null);
const reportError = vi.fn(async () => undefined);

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  openUrl.mockReset();
  openUrl.mockImplementation(async () => null);
  reportError.mockClear();
  stubStoryInvoke({ open_url: (args: unknown) => openUrl(args) });
  useAppStore.setState({ reportError });
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
  document.body.innerHTML = '';
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
    expect(openUrl).toHaveBeenCalledWith({ url: 'https://example.com/docs' });
  });

  it('reports a toast when the link cannot be opened, and files no crash', async () => {
    openUrl.mockRejectedValueOnce(new Error('refused'));
    renderHook(() => useCommitLinkInterceptor());
    clickAnchor('https://example.com/docs');
    await waitFor(() => expect(reportError).toHaveBeenCalledTimes(1));
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Couldn't open the link" }),
    );
  });

  it('leaves a mailto link alone, since the backend refuses it', () => {
    renderHook(() => useCommitLinkInterceptor());
    clickAnchor('mailto:team@northwind.example');
    expect(openUrl).not.toHaveBeenCalled();
  });

  it('ignores modifier-clicks so the OS can handle them', () => {
    const { result } = renderHook(() => useCommitLinkInterceptor());
    clickAnchor('https://github.com/owner/repo/commit/abc1234', { metaKey: true });
    expect(result.current.commitDiff).toBeNull();
    expect(openUrl).not.toHaveBeenCalled();
  });

  it('ignores clicks on anchors without an href', () => {
    const { result } = renderHook(() => useCommitLinkInterceptor());
    clickAnchor(null);
    expect(result.current.commitDiff).toBeNull();
    expect(openUrl).not.toHaveBeenCalled();
  });
});
