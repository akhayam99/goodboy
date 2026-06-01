// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

const { extractMock, resolveMock } = vi.hoisted(() => ({
  extractMock: vi.fn<(text: string) => unknown>(() => null),
  resolveMock: vi.fn(async () => true),
}));

vi.mock('@goodboy/core', () => ({
  extractCommentResolved: extractMock,
  isReviewThreadId: (id: string) => /^PRT_/.test(id),
}));
vi.mock('../../../../store', () => ({
  useAppStore: <T,>(
    selector: (s: {
      resolveGithubThread: typeof resolveMock;
      sessionGithub: Record<string, unknown>;
    }) => T,
  ) => selector({ resolveGithubThread: resolveMock, sessionGithub: {} }),
}));

import { CommentResolvedChip } from './index';

beforeEach(() => {
  extractMock.mockReset();
  resolveMock.mockReset().mockResolvedValue(true);
});
afterEach(cleanup);

describe('CommentResolvedChip', () => {
  it('renders nothing when no marker is found', () => {
    extractMock.mockReturnValue(null);
    const { container } = render(<CommentResolvedChip assistantText="" sessionId={'s' as never} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when the marker references a local diff comment id', () => {
    extractMock.mockReturnValue({
      threadId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      commitSha: 'abcdef1234567890',
    });
    const { container } = render(
      <CommentResolvedChip assistantText="x" sessionId={'s' as never} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('resolves the thread when the confirm button is clicked', async () => {
    extractMock.mockReturnValue({ threadId: 'PRT_kwDOABC123', commitSha: 'abcdef1234567890' });
    render(<CommentResolvedChip assistantText="x" sessionId={'s' as never} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('comment-resolved-confirm'));
    });
    expect(resolveMock).toHaveBeenCalledWith('s', 'PRT_kwDOABC123', {
      commitSha: 'abcdef1234567890',
    });
    expect(screen.getByText(/conversation resolved/i)).toBeDefined();
  });
});
