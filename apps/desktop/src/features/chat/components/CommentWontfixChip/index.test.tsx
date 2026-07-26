// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const h = vi.hoisted(() => ({
  extract: vi.fn<(text: string) => unknown>(() => null),
}));

vi.mock('@goodboy/core', () => ({
  extractCommentWontfix: h.extract,
  isReviewThreadId: (id: string) => /^PRRT_/.test(id),
}));

import { CommentWontfixChip } from '.';

describe('CommentWontfixChip', () => {
  beforeEach(() => h.extract.mockReset());
  afterEach(cleanup);

  it('renders nothing without a review marker', () => {
    h.extract.mockReturnValue(null);
    const { container, rerender } = render(
      <CommentWontfixChip assistantText="" sessionId={'s' as never} />,
    );
    expect(container.firstChild).toBeNull();

    h.extract.mockReturnValue({ threadId: 'local-1', reason: 'no change' });
    rerender(<CommentWontfixChip assistantText="x" sessionId={'s' as never} />);
    expect(container.firstChild).toBeNull();
  });

  it('keeps the status reason and replaces actions with a manage link', () => {
    h.extract.mockReturnValue({ threadId: 'PRRT_1', reason: 'already covered upstream' });
    render(
      <CommentWontfixChip
        assistantText="x"
        sessionId={'s' as never}
        agentId={'agent-1' as never}
      />,
    );

    expect(screen.getByText('already covered upstream')).toBeDefined();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByText('Manage in panel')).toBeDefined();
  });

  it('opens the resolver inspector from the manage link', () => {
    h.extract.mockReturnValue({ threadId: 'PRRT_1', reason: 'no change' });
    const onOpen = vi.fn();
    window.addEventListener('goodboy:open-resolver-inspector', onOpen);
    render(
      <CommentWontfixChip
        assistantText="x"
        sessionId={'s' as never}
        agentId={'agent-1' as never}
      />,
    );

    fireEvent.click(screen.getByTestId('comment-wontfix-manage'));

    const event = onOpen.mock.calls[0]?.[0] as CustomEvent;
    expect(event.detail).toEqual({ sessionId: 's', agentId: 'agent-1' });
    window.removeEventListener('goodboy:open-resolver-inspector', onOpen);
  });
});
