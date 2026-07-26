// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const h = vi.hoisted(() => ({
  extract: vi.fn<(text: string) => unknown>(() => null),
  pending: [] as Array<{ threadId: string }>,
}));

vi.mock('@goodboy/core', () => ({
  extractCommentResolved: h.extract,
  isReviewThreadId: (id: string) => /^PRRT_/.test(id),
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(
    selector: (state: {
      sessionGithub: Record<string, { detail: null }>;
      sessionPendingResolutions: Record<string, Array<{ threadId: string }>>;
    }) => T,
  ) =>
    selector({
      sessionGithub: { s: { detail: null } },
      sessionPendingResolutions: { s: h.pending },
    }),
}));

import { CommentResolvedChip } from '.';

describe('CommentResolvedChip', () => {
  beforeEach(() => {
    h.extract.mockReset();
    h.pending = [];
    localStorage.clear();
  });

  afterEach(cleanup);

  it('renders nothing without a review marker', () => {
    h.extract.mockReturnValue(null);
    const { container, rerender } = render(
      <CommentResolvedChip assistantText="" sessionId={'s' as never} />,
    );
    expect(container.firstChild).toBeNull();

    h.extract.mockReturnValue({ threadId: 'local-1', commitSha: 'abcdef1234567890' });
    rerender(<CommentResolvedChip assistantText="x" sessionId={'s' as never} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows queued status without action buttons', () => {
    h.extract.mockReturnValue({ threadId: 'PRRT_1', commitSha: 'abcdef1234567890' });
    h.pending = [{ threadId: 'PRRT_1' }];
    render(
      <CommentResolvedChip
        assistantText="x"
        sessionId={'s' as never}
        agentId={'agent-1' as never}
      />,
    );

    expect(screen.getByText(/pending push/i)).toBeDefined();
    expect(screen.queryByText('Push now')).toBeNull();
    expect(screen.getByText('Manage in panel')).toBeDefined();
  });

  it('opens the resolver inspector from the manage link', () => {
    h.extract.mockReturnValue({ threadId: 'PRRT_1', commitSha: 'abcdef1234567890' });
    const onOpen = vi.fn();
    window.addEventListener('goodboy:open-resolver-inspector', onOpen);
    render(
      <CommentResolvedChip
        assistantText="x"
        sessionId={'s' as never}
        agentId={'agent-1' as never}
      />,
    );

    fireEvent.click(screen.getByTestId('comment-resolved-manage'));

    expect(onOpen).toHaveBeenCalledOnce();
    const event = onOpen.mock.calls[0]?.[0] as CustomEvent;
    expect(event.detail).toEqual({ sessionId: 's', agentId: 'agent-1' });
    window.removeEventListener('goodboy:open-resolver-inspector', onOpen);
  });
});
