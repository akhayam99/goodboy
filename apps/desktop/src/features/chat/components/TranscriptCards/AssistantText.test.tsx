// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

vi.mock('@goodboy/core', () => ({
  extractAllCommentResolved: () => [
    { threadId: 'local-1', commitSha: 'abcdef1' },
    { threadId: 'PRRT_2', commitSha: 'abcdef2' },
  ],
  isReviewThreadId: (threadId: string) => threadId.startsWith('PRRT_'),
  stripControlMarkers: (text: string) => text,
}));

vi.mock('@goodboy/ui', () => ({
  CopyButton: () => <button type="button">copy</button>,
  Markdown: ({ text }: { text: string }) => <div>{text}</div>,
}));

vi.mock('../ClustersCard', () => ({ ClustersCard: () => null }));
vi.mock('../CommentAnalysisChip', () => ({ CommentAnalysisChip: () => null }));
vi.mock('../CommentResolvedChip', () => ({ CommentResolvedChip: () => null }));
vi.mock('../CommentWontfixChip', () => ({ CommentWontfixChip: () => null }));
vi.mock('../HandoffChip', () => ({ HandoffChip: () => null }));
vi.mock('../PlanChip', () => ({ PlanChip: () => null }));
import { AssistantText } from './AssistantText';

afterEach(cleanup);

describe('AssistantText', () => {
  it('renders prose bare on the page, with no box around it', () => {
    const { container } = render(<AssistantText text="assistant response" sessionId={null} />);
    const root = container.firstElementChild!;

    expect(root.className).toBe('group relative flex flex-col gap-2 text-sm leading-relaxed');
  });

  it('hides copy when a non-first resolved marker belongs to a review thread', () => {
    render(<AssistantText text="assistant response" sessionId={null} />);

    expect(screen.queryByRole('button', { name: 'copy' })).toBeNull();
  });
});
