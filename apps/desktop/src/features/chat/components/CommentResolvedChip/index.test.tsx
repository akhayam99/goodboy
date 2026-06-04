// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

const h = vi.hoisted(() => ({
  extractMock: vi.fn<(text: string) => unknown>(() => null),
  resolveMock: vi.fn(async () => true),
  queueMock: vi.fn(async () => {}),
  dequeueMock: vi.fn(async () => {}),
  loadMock: vi.fn(async () => {}),
  pr: { number: 123 } as { number: number } | null,
  pending: [] as Array<{ threadId: string }>,
}));

vi.mock('@goodboy/core', () => ({
  extractCommentResolved: h.extractMock,
  isReviewThreadId: (id: string) => /^PRRT_/.test(id),
}));
vi.mock('../../../../store', () => ({
  useAppStore: <T,>(
    selector: (s: {
      queueResolution: typeof h.queueMock;
      dequeueResolution: typeof h.dequeueMock;
      resolveGithubThread: typeof h.resolveMock;
      loadPendingResolutions: typeof h.loadMock;
      sessionGithub: Record<string, { pr: { number: number } | null; detail: null }>;
      sessionPendingResolutions: Record<string, Array<{ threadId: string }>>;
    }) => T,
  ) =>
    selector({
      queueResolution: h.queueMock,
      dequeueResolution: h.dequeueMock,
      resolveGithubThread: h.resolveMock,
      loadPendingResolutions: h.loadMock,
      sessionGithub: { s: { pr: h.pr, detail: null } },
      sessionPendingResolutions: { s: h.pending },
    }),
}));

import { CommentResolvedChip } from './index';

beforeEach(() => {
  h.extractMock.mockReset();
  h.resolveMock.mockReset().mockResolvedValue(true);
  h.queueMock.mockReset().mockResolvedValue(undefined);
  h.dequeueMock.mockReset().mockResolvedValue(undefined);
  h.loadMock.mockReset().mockResolvedValue(undefined);
  h.pr = { number: 123 };
  h.pending = [];
});
afterEach(cleanup);

describe('CommentResolvedChip', () => {
  it('renders nothing when no marker is found', () => {
    h.extractMock.mockReturnValue(null);
    const { container } = render(<CommentResolvedChip assistantText="" sessionId={'s' as never} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when the marker references a local diff comment id', () => {
    h.extractMock.mockReturnValue({
      threadId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      commitSha: 'abcdef1234567890',
    });
    const { container } = render(
      <CommentResolvedChip assistantText="x" sessionId={'s' as never} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('queues the resolution when the primary button is clicked', async () => {
    h.extractMock.mockReturnValue({ threadId: 'PRRT_kwDOABC123', commitSha: 'abcdef1234567890' });
    render(<CommentResolvedChip assistantText="x" sessionId={'s' as never} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('comment-resolved-queue'));
    });
    expect(h.queueMock).toHaveBeenCalledWith('s', {
      threadId: 'PRRT_kwDOABC123',
      commitSha: 'abcdef1234567890',
      prNumber: 123,
    });
  });

  it('pushes and resolves the thread when the secondary button is clicked', async () => {
    h.extractMock.mockReturnValue({ threadId: 'PRRT_kwDOABC123', commitSha: 'abcdef1234567890' });
    render(<CommentResolvedChip assistantText="x" sessionId={'s' as never} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('comment-resolved-confirm'));
    });
    expect(h.resolveMock).toHaveBeenCalledWith('s', 'PRRT_kwDOABC123', {
      commitSha: 'abcdef1234567890',
    });
    expect(screen.getByText(/conversation resolved/i)).toBeDefined();
  });

  it('shows the pending-push state when the thread is queued', () => {
    h.extractMock.mockReturnValue({ threadId: 'PRRT_kwDOABC123', commitSha: 'abcdef1234567890' });
    h.pending = [{ threadId: 'PRRT_kwDOABC123' }];
    render(<CommentResolvedChip assistantText="x" sessionId={'s' as never} />);
    expect(screen.getByText(/pending push/i)).toBeDefined();
  });
});
