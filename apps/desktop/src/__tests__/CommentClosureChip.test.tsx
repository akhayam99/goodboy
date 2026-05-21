// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SessionId } from '@goodboy/types';

const { resolveGithubThreadMock, mockStore } = await vi.hoisted(async () => {
  const { create } = await import('zustand');
  const fn = vi.fn(async () => true);
  interface S {
    resolveGithubThread: typeof fn;
  }
  const store = create<S>(() => ({ resolveGithubThread: fn }));
  return { resolveGithubThreadMock: fn, mockStore: store };
});

vi.mock('../store', () => ({
  useAppStore: mockStore,
}));

const { CommentClosureChip } = await import('../features/chat/components/CommentClosureChip');

const SESSION_ID = 'sess-1' as SessionId;

afterEach(() => {
  cleanup();
  resolveGithubThreadMock.mockClear();
});

describe('CommentClosureChip', () => {
  it('renders nothing when no marker is present', () => {
    const { container } = render(
      <CommentClosureChip assistantText="plain text, no marker" sessionId={SESSION_ID} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the resolved variant when only the resolved marker is present', () => {
    render(
      <CommentClosureChip
        assistantText={'fix applied. <<comment-resolved threadId="PRT_1" commit="abcdef1234">>'}
        sessionId={SESSION_ID}
      />,
    );
    expect(screen.getByRole('button', { name: /mark as solved/i })).toBeTruthy();
    expect(screen.getByText(/fix committed locally/i)).toBeTruthy();
  });

  it('renders the dismissed variant when only the dismissed marker is present', () => {
    render(
      <CommentClosureChip
        assistantText={'<<comment-dismissed threadId="PRT_9" reason="off-topic for this PR">>'}
        sessionId={SESSION_ID}
      />,
    );
    expect(screen.getByRole('button', { name: /close conversation on github/i })).toBeTruthy();
    expect(screen.getByText(/comment dismissed/i)).toBeTruthy();
    expect(screen.getByText(/off-topic for this PR/i)).toBeTruthy();
  });

  it('prefers the resolved variant when both markers appear', () => {
    render(
      <CommentClosureChip
        assistantText={
          '<<comment-resolved threadId="PRT_1" commit="aaa1234">> also <<comment-dismissed threadId="PRT_2" reason="dup">>'
        }
        sessionId={SESSION_ID}
      />,
    );
    expect(screen.getByRole('button', { name: /mark as solved/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /close conversation on github/i })).toBeNull();
  });

  it('clicking close-on-github posts the reason payload', async () => {
    render(
      <CommentClosureChip
        assistantText={'<<comment-dismissed threadId="PRT_9" reason="wontfix">>'}
        sessionId={SESSION_ID}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /close conversation on github/i }));
    expect(resolveGithubThreadMock).toHaveBeenCalledTimes(1);
    const [sid, tid, closure] = resolveGithubThreadMock.mock.calls[0]!;
    expect(sid).toBe(SESSION_ID);
    expect(tid).toBe('PRT_9');
    expect(closure).toEqual({ reason: 'wontfix' });
  });

  it('dismissing the chip via the X button hides it without calling github', async () => {
    render(
      <CommentClosureChip
        assistantText={'<<comment-dismissed threadId="PRT_9" reason="not relevant">>'}
        sessionId={SESSION_ID}
      />,
    );
    await userEvent.click(
      screen.getByRole('button', { name: /keep the conversation open on github/i }),
    );
    expect(screen.queryByText(/comment dismissed/i)).toBeNull();
    expect(resolveGithubThreadMock).not.toHaveBeenCalled();
  });
});
