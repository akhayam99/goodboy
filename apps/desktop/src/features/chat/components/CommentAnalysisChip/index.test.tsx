// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const h = vi.hoisted(() => ({
  extract: vi.fn<(text: string) => unknown>(() => null),
}));

vi.mock('@goodboy/core', () => ({
  extractCommentAnalysis: h.extract,
  isReviewThreadId: (id: string) => /^PRRT_/.test(id),
}));

import { CommentAnalysisChip } from '.';

describe('CommentAnalysisChip', () => {
  beforeEach(() => {
    h.extract.mockReset();
    localStorage.clear();
  });
  afterEach(cleanup);

  it('renders nothing without a review marker', () => {
    h.extract.mockReturnValue(null);
    const { container } = render(<CommentAnalysisChip assistantText="" sessionId={'s' as never} />);
    expect(container.firstChild).toBeNull();
  });

  it('keeps the analysis status without resolution actions', () => {
    h.extract.mockReturnValue({
      threadId: 'PRRT_1',
      verdict: 'fix',
      summary: '**Use the shared helper**',
    });
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
    h.extract.mockReturnValue({
      threadId: 'PRRT_1',
      verdict: 'wontfix',
      summary: 'No change',
    });
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
});
