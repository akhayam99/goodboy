// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  extractMock: vi.fn<(text: string) => unknown>(() => null),
  sendMock: vi.fn(async () => undefined),
  resolveMock: vi.fn(async () => true),
  resolvedComments: [] as Array<{ threadId: string; resolved: boolean }>,
}));

vi.mock('@goodboy/core', () => ({
  extractCommentAnalysis: h.extractMock,
  isReviewThreadId: (id: string) => /^PRRT_/.test(id),
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(
    selector: (state: {
      sendTurn: typeof h.sendMock;
      resolveGithubThread: typeof h.resolveMock;
      sessionGithub: Record<
        string,
        { detail: { comments: Array<{ threadId: string; resolved: boolean }> } }
      >;
    }) => T,
  ) =>
    selector({
      sendTurn: h.sendMock,
      resolveGithubThread: h.resolveMock,
      sessionGithub: { s: { detail: { comments: h.resolvedComments } } },
    }),
}));

import { CommentAnalysisChip } from './index';

beforeEach(() => {
  h.extractMock.mockReset();
  h.sendMock.mockReset().mockResolvedValue(undefined);
  h.resolveMock.mockReset().mockResolvedValue(true);
  h.resolvedComments = [];
  localStorage.clear();
});

afterEach(cleanup);

describe('CommentAnalysisChip', () => {
  it('renders nothing without a valid review analysis marker', () => {
    h.extractMock.mockReturnValue(null);
    const { container, rerender } = render(
      <CommentAnalysisChip assistantText="" sessionId={'s' as never} agentId={'a' as never} />,
    );
    expect(container.firstChild).toBeNull();

    h.extractMock.mockReturnValue({ threadId: 'local-1', verdict: 'fix', summary: 'Use a helper' });
    rerender(
      <CommentAnalysisChip assistantText="x" sessionId={'s' as never} agentId={'a' as never} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders a fix verdict and routes proceed to the resolver', async () => {
    h.extractMock.mockReturnValue({
      threadId: 'PRRT_1',
      verdict: 'fix',
      summary: '**Use the shared helper**',
    });
    render(
      <CommentAnalysisChip assistantText="x" sessionId={'s' as never} agentId={'a' as never} />,
    );

    expect(screen.getByText('fix recommended')).toBeDefined();
    expect(screen.getByText('Use the shared helper')).toBeDefined();
    await act(async () => {
      fireEvent.click(screen.getByTestId('comment-analysis-proceed'));
    });
    expect(h.sendMock).toHaveBeenCalledWith({
      sessionId: 's',
      agentId: 'a',
      content:
        'Proceed with the fix you proposed in your analysis. When done, commit and emit the <<comment-resolved>> marker as instructed.',
    });
  });

  it('posts an edited explanation and marks the thread solved', async () => {
    h.extractMock.mockReturnValue({
      threadId: 'PRRT_2',
      verdict: 'fix',
      summary: 'Original summary',
    });
    render(
      <CommentAnalysisChip assistantText="x" sessionId={'s' as never} agentId={'a' as never} />,
    );

    fireEvent.click(screen.getByTestId('comment-analysis-close'));
    fireEvent.change(screen.getByRole('textbox', { name: 'explanation' }), {
      target: { value: 'Edited explanation' },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('comment-analysis-confirm'));
    });

    expect(h.resolveMock).toHaveBeenCalledWith('s', 'PRRT_2', {
      reason: 'Edited explanation',
    });
    expect(screen.getByText(/marked solved with explanation/i)).toBeDefined();
  });

  it('makes close primary for wontfix while allowing an override', async () => {
    h.extractMock.mockReturnValue({
      threadId: 'PRRT_3',
      verdict: 'wontfix',
      summary: 'Already covered',
    });
    render(
      <CommentAnalysisChip assistantText="x" sessionId={'s' as never} agentId={'a' as never} />,
    );

    const buttons = screen.getAllByRole('button');
    expect(buttons[0]?.textContent).toContain('Close with explanation');
    expect(screen.getByText('Proceed with fix anyway')).toBeDefined();
    await act(async () => {
      fireEvent.click(screen.getByTestId('comment-analysis-proceed'));
    });
    expect(h.sendMock).toHaveBeenCalledOnce();
  });

  it('shows success when the thread is already resolved on github', () => {
    h.extractMock.mockReturnValue({
      threadId: 'PRRT_4',
      verdict: 'wontfix',
      summary: 'No change needed',
    });
    h.resolvedComments = [{ threadId: 'PRRT_4', resolved: true }];
    render(
      <CommentAnalysisChip assistantText="x" sessionId={'s' as never} agentId={'a' as never} />,
    );
    expect(screen.getByText(/marked solved with explanation/i)).toBeDefined();
  });
});
