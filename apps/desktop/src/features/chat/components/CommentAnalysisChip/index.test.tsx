// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const h = vi.hoisted(() => ({
  extract: vi.fn<(text: string) => ReadonlyArray<unknown>>(() => []),
  replies: vi.fn<(text: string) => ReadonlyArray<{ threadId: string; body: string }>>(() => []),
}));

vi.mock('@goodboy/core', () => ({
  extractAllCommentAnalysis: h.extract,
  extractAllCommentReplies: h.replies,
  isReviewThreadId: (id: string) => /^PRRT_/.test(id),
}));

import { CommentAnalysisChip } from '.';

describe('CommentAnalysisChip', () => {
  beforeEach(() => {
    h.extract.mockReset();
    h.extract.mockReturnValue([]);
    h.replies.mockReset();
    h.replies.mockReturnValue([]);
    localStorage.clear();
  });
  afterEach(cleanup);

  it('renders nothing without a review marker', () => {
    const { container } = render(<CommentAnalysisChip assistantText="" sessionId={'s' as never} />);
    expect(container.firstChild).toBeNull();
  });

  it('keeps the analysis status without resolution actions', () => {
    h.extract.mockReturnValue([
      {
        threadId: 'PRRT_1',
        verdict: 'fix',
        summary: '**Use the shared helper**',
      },
    ]);
    render(
      <CommentAnalysisChip
        assistantText="x"
        sessionId={'s' as never}
        agentId={'agent-1' as never}
      />,
    );

    expect(screen.getByText('fix recommended')).toBeDefined();
    expect(screen.getByText('Use the shared helper')).toBeDefined();
    expect(screen.queryByText('Proceed with fix')).toBeNull();
    expect(screen.getByText('Manage in panel')).toBeDefined();
  });

  it('opens the resolver inspector from the manage link', () => {
    h.extract.mockReturnValue([
      {
        threadId: 'PRRT_1',
        verdict: 'wontfix',
        summary: 'No change',
      },
    ]);
    const onOpen = vi.fn();
    window.addEventListener('goodboy:open-resolver-inspector', onOpen);
    render(
      <CommentAnalysisChip
        assistantText="x"
        sessionId={'s' as never}
        agentId={'agent-1' as never}
      />,
    );

    fireEvent.click(screen.getByTestId('comment-analysis-manage'));

    const event = onOpen.mock.calls[0]?.[0] as CustomEvent;
    expect(event.detail).toEqual({ sessionId: 's', agentId: 'agent-1' });
    window.removeEventListener('goodboy:open-resolver-inspector', onOpen);
  });

  it('renders every analysis with its matching reply preview', () => {
    h.extract.mockReturnValue([
      { threadId: 'PRRT_1', verdict: 'fix', summary: 'Fix this' },
      { threadId: 'PRRT_2', verdict: 'wontfix', summary: 'Leave this' },
    ]);
    h.replies.mockReturnValue([{ threadId: 'PRRT_2', body: 'This is already guarded upstream' }]);

    render(<CommentAnalysisChip assistantText="x" sessionId={'s' as never} />);

    expect(screen.getByText('PRRT_1')).toBeDefined();
    expect(screen.getByText('PRRT_2')).toBeDefined();
    expect(screen.getByTitle('This is already guarded upstream')).toBeDefined();
  });
});
