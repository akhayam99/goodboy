// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

const h = vi.hoisted(() => ({
  extractMock: vi.fn<(text: string) => unknown>(() => null),
  resolveMock: vi.fn(async () => true),
  resolvedComments: [] as Array<{ threadId: string; resolved: boolean }>,
}));

vi.mock('@goodboy/core', () => ({
  extractCommentWontfix: h.extractMock,
  isReviewThreadId: (id: string) => /^PRRT_/.test(id),
}));
vi.mock('../../../../store', () => ({
  useAppStore: <T,>(
    selector: (s: {
      resolveGithubThread: typeof h.resolveMock;
      sessionGithub: Record<
        string,
        { detail: { comments: Array<{ threadId: string; resolved: boolean }> } }
      >;
    }) => T,
  ) =>
    selector({
      resolveGithubThread: h.resolveMock,
      sessionGithub: { s: { detail: { comments: h.resolvedComments } } },
    }),
}));

import { CommentWontfixChip } from './index';

beforeEach(() => {
  h.extractMock.mockReset();
  h.resolveMock.mockReset().mockResolvedValue(true);
  h.resolvedComments = [];
});
afterEach(cleanup);

describe('CommentWontfixChip', () => {
  it('renders nothing when no marker is found', () => {
    h.extractMock.mockReturnValue(null);
    const { container } = render(<CommentWontfixChip assistantText="" sessionId={'s' as never} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing for a non-review thread id', () => {
    h.extractMock.mockReturnValue({ threadId: 'th-1', reason: 'nope' });
    const { container } = render(<CommentWontfixChip assistantText="x" sessionId={'s' as never} />);
    expect(container.firstChild).toBeNull();
  });

  it('posts the reason and resolves the thread when clicked', async () => {
    h.extractMock.mockReturnValue({ threadId: 'PRRT_9', reason: 'already covered upstream' });
    render(<CommentWontfixChip assistantText="x" sessionId={'s' as never} />);
    const explanation = screen.getByRole('textbox', { name: 'explanation' });
    expect((explanation as HTMLTextAreaElement).value).toBe('already covered upstream');
    fireEvent.change(explanation, { target: { value: 'covered by the new helper' } });
    await act(async () => {
      fireEvent.click(screen.getByTestId('comment-wontfix-explain'));
    });
    expect(h.resolveMock).toHaveBeenCalledWith('s', 'PRRT_9', {
      reason: 'covered by the new helper',
    });
    expect(screen.getByText(/marked solved with explanation/i)).toBeDefined();
  });

  it('shows the resolved state when the thread is already resolved on github', () => {
    h.extractMock.mockReturnValue({ threadId: 'PRRT_9', reason: 'already covered upstream' });
    h.resolvedComments = [{ threadId: 'PRRT_9', resolved: true }];
    render(<CommentWontfixChip assistantText="x" sessionId={'s' as never} />);
    expect(screen.getByText(/marked solved with explanation/i)).toBeDefined();
  });
});
