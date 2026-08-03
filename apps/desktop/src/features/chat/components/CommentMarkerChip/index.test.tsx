// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const h = vi.hoisted(() => ({
  analysis: vi.fn<(text: string) => ReadonlyArray<unknown>>(() => []),
  resolved: vi.fn<(text: string) => ReadonlyArray<unknown>>(() => []),
  wontfix: vi.fn<(text: string) => ReadonlyArray<unknown>>(() => []),
  replies: vi.fn<(text: string) => ReadonlyArray<{ threadId: string; body: string }>>(() => []),
  pending: [] as Array<{ threadId: string }>,
  selectAgent: vi.fn(async () => undefined),
}));

vi.mock('@goodboy/core', () => ({
  extractAllCommentAnalysis: h.analysis,
  extractAllCommentResolved: h.resolved,
  extractAllCommentWontfix: h.wontfix,
  extractAllCommentReplies: h.replies,
  isReviewThreadId: (id: string) => /^PRRT_/.test(id),
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(
    selector: (state: {
      sessionGithub: Record<string, { detail: null }>;
      sessionPendingResolutions: Record<string, Array<{ threadId: string }>>;
      selectAgent: typeof h.selectAgent;
    }) => T,
  ) =>
    selector({
      sessionGithub: { s: { detail: null } },
      sessionPendingResolutions: { s: h.pending },
      selectAgent: h.selectAgent,
    }),
}));

import { CommentMarkerChip } from '.';

describe('CommentMarkerChip', () => {
  beforeEach(() => {
    h.analysis.mockReset();
    h.analysis.mockReturnValue([]);
    h.resolved.mockReset();
    h.resolved.mockReturnValue([]);
    h.wontfix.mockReset();
    h.wontfix.mockReturnValue([]);
    h.replies.mockReset();
    h.replies.mockReturnValue([]);
    h.pending = [];
    h.selectAgent.mockClear();
  });

  afterEach(cleanup);

  it('renders nothing without an analysis marker', () => {
    const { container } = render(
      <CommentMarkerChip kind="analysis" assistantText="" sessionId={'s' as never} />,
    );

    expect(container.firstChild).toBeNull();
  });

  it('keeps the analysis status without resolution actions', () => {
    h.analysis.mockReturnValue([
      {
        threadId: 'PRRT_1',
        verdict: 'fix',
        summary: '**Use the shared helper**',
      },
    ]);
    render(
      <CommentMarkerChip
        kind="analysis"
        assistantText="x"
        sessionId={'s' as never}
        agentId={'agent-1' as never}
      />,
    );

    expect(screen.getByText('fix recommended')).toBeDefined();
    expect(screen.getByText('Use the shared helper')).toBeDefined();
    expect(screen.queryByText('Proceed with fix')).toBeNull();
    expect(screen.getAllByRole('button')).toEqual([screen.getByTestId('comment-analysis-open')]);
  });

  it('selects the resolver and reveals its chat when the chip is clicked', () => {
    h.analysis.mockReturnValue([
      {
        threadId: 'PRRT_1',
        verdict: 'wontfix',
        summary: 'No change',
      },
    ]);
    const reveal = vi.fn();
    window.addEventListener('goodboy:reveal-chat', reveal);
    render(
      <CommentMarkerChip
        kind="analysis"
        assistantText="x"
        sessionId={'s' as never}
        agentId={'agent-1' as never}
      />,
    );

    fireEvent.click(screen.getByTestId('comment-analysis-open'));

    expect(h.selectAgent).toHaveBeenCalledWith('s', 'agent-1');
    expect(reveal).toHaveBeenCalledOnce();
    window.removeEventListener('goodboy:reveal-chat', reveal);
  });

  it('stays inert without a resolver to navigate to', () => {
    h.analysis.mockReturnValue([{ threadId: 'PRRT_1', verdict: 'fix', summary: 'Fix this' }]);
    render(<CommentMarkerChip kind="analysis" assistantText="x" sessionId={'s' as never} />);

    expect(screen.queryByTestId('comment-analysis-open')).toBeNull();
  });

  it('renders every analysis with its matching reply preview', () => {
    h.analysis.mockReturnValue([
      { threadId: 'PRRT_1', verdict: 'fix', summary: 'Fix this' },
      { threadId: 'PRRT_2', verdict: 'wontfix', summary: 'Leave this' },
    ]);
    h.replies.mockReturnValue([{ threadId: 'PRRT_2', body: 'This is already guarded upstream' }]);

    render(<CommentMarkerChip kind="analysis" assistantText="x" sessionId={'s' as never} />);

    expect(screen.getByText('PRRT_1')).toBeDefined();
    expect(screen.getByText('PRRT_2')).toBeDefined();
    expect(screen.getByTitle('This is already guarded upstream')).toBeDefined();
  });

  it('renders nothing without a resolved review marker', () => {
    const { container, rerender } = render(
      <CommentMarkerChip kind="resolved" assistantText="" sessionId={'s' as never} />,
    );
    expect(container.firstChild).toBeNull();

    h.resolved.mockReturnValue([{ threadId: 'local-1', commitSha: 'abcdef1234567890' }]);
    rerender(<CommentMarkerChip kind="resolved" assistantText="x" sessionId={'s' as never} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows queued status without action buttons', () => {
    h.resolved.mockReturnValue([{ threadId: 'PRRT_1', commitSha: 'abcdef1234567890' }]);
    h.pending = [{ threadId: 'PRRT_1' }];
    render(
      <CommentMarkerChip
        kind="resolved"
        assistantText="x"
        sessionId={'s' as never}
        agentId={'agent-1' as never}
      />,
    );

    expect(screen.getByText(/pending push/i)).toBeDefined();
    expect(screen.queryByText('Push now')).toBeNull();
    expect(screen.getAllByRole('button')).toEqual([screen.getByTestId('comment-resolved-open')]);
  });

  it('navigates to the resolver from a resolved chip', () => {
    h.resolved.mockReturnValue([{ threadId: 'PRRT_1', commitSha: 'abcdef1234567890' }]);
    render(
      <CommentMarkerChip
        kind="resolved"
        assistantText="x"
        sessionId={'s' as never}
        agentId={'agent-1' as never}
      />,
    );

    fireEvent.click(screen.getByTestId('comment-resolved-open'));

    expect(h.selectAgent).toHaveBeenCalledWith('s', 'agent-1');
  });

  it('renders every resolved thread with its matching reply preview', () => {
    h.resolved.mockReturnValue([
      { threadId: 'PRRT_1', commitSha: 'abcdef1234567890' },
      { threadId: 'PRRT_2', commitSha: '1234567890abcdef' },
    ]);
    h.replies.mockReturnValue([
      { threadId: 'PRRT_1', body: 'First full reply to the reviewer' },
      { threadId: 'PRRT_2', body: 'Second full reply to the reviewer' },
    ]);

    render(<CommentMarkerChip kind="resolved" assistantText="x" sessionId={'s' as never} />);

    expect(screen.getByText('PRRT_1')).toBeDefined();
    expect(screen.getByText('PRRT_2')).toBeDefined();
    expect(screen.getByTitle('First full reply to the reviewer')).toBeDefined();
    expect(screen.getByTitle('Second full reply to the reviewer')).toBeDefined();
  });

  it('renders nothing without a wontfix review marker', () => {
    const { container, rerender } = render(
      <CommentMarkerChip kind="wontfix" assistantText="" sessionId={'s' as never} />,
    );
    expect(container.firstChild).toBeNull();

    h.wontfix.mockReturnValue([{ threadId: 'local-1', reason: 'no change' }]);
    rerender(<CommentMarkerChip kind="wontfix" assistantText="x" sessionId={'s' as never} />);
    expect(container.firstChild).toBeNull();
  });

  it('keeps the wontfix status reason and executes nothing', () => {
    h.wontfix.mockReturnValue([{ threadId: 'PRRT_1', reason: 'already covered upstream' }]);
    render(
      <CommentMarkerChip
        kind="wontfix"
        assistantText="x"
        sessionId={'s' as never}
        agentId={'agent-1' as never}
      />,
    );

    expect(screen.getByText('already covered upstream')).toBeDefined();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getAllByRole('button')).toEqual([screen.getByTestId('comment-wontfix-open')]);
  });

  it('navigates to the resolver from a wontfix chip', () => {
    h.wontfix.mockReturnValue([{ threadId: 'PRRT_1', reason: 'no change' }]);
    render(
      <CommentMarkerChip
        kind="wontfix"
        assistantText="x"
        sessionId={'s' as never}
        agentId={'agent-1' as never}
      />,
    );

    fireEvent.click(screen.getByTestId('comment-wontfix-open'));

    expect(h.selectAgent).toHaveBeenCalledWith('s', 'agent-1');
  });

  it('renders every wontfix marker with its matching reply preview', () => {
    h.wontfix.mockReturnValue([
      { threadId: 'PRRT_1', reason: 'Already fixed' },
      { threadId: 'PRRT_2', reason: 'Out of scope' },
    ]);
    h.replies.mockReturnValue([{ threadId: 'PRRT_1', body: 'The earlier commit covers this' }]);

    render(<CommentMarkerChip kind="wontfix" assistantText="x" sessionId={'s' as never} />);

    expect(screen.getByText('PRRT_1')).toBeDefined();
    expect(screen.getByText('PRRT_2')).toBeDefined();
    expect(screen.getByTitle('The earlier commit covers this')).toBeDefined();
  });
});
