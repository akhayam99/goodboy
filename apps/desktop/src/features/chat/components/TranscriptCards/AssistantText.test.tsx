// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

const { extractAllCommentResolvedMock } = vi.hoisted(() => ({
  extractAllCommentResolvedMock: vi.fn(() => [] as ReadonlyArray<{ threadId: string }>),
}));

vi.mock('@goodboy/core', () => ({
  extractAllCommentResolved: extractAllCommentResolvedMock,
  isReviewThreadId: (threadId: string) => threadId.startsWith('PRRT_'),
  stripControlMarkers: (text: string) => text,
}));

vi.mock('@goodboy/ui', () => ({
  CopyButton: () => <button type="button">copy</button>,
  Markdown: ({ text }: { text: string }) => <div>{text}</div>,
}));

vi.mock('../ClustersCard', () => ({ ClustersCard: () => null }));
vi.mock('../HandoffChip', () => ({ HandoffChip: () => null }));
vi.mock('../PlanChip', () => ({ PlanChip: () => null }));
vi.mock('../ResolverThreadsCard', () => ({ ResolverThreadsCard: () => null }));
import { AssistantText } from './AssistantText';

afterEach(cleanup);

describe('AssistantText', () => {
  it('renders prose bare on the page, with no box around it', () => {
    const { container } = render(<AssistantText text="assistant response" sessionId={null} />);
    const root = container.firstElementChild!;

    expect(root.className).toBe('group relative flex flex-col gap-2 text-sm leading-relaxed');
  });

  it('hides copy when a non-first resolved marker belongs to a review thread', () => {
    extractAllCommentResolvedMock.mockReturnValueOnce([
      { threadId: 'local-1' },
      { threadId: 'PRRT_2' },
    ]);
    render(<AssistantText text="assistant response" sessionId={null} />);

    expect(screen.queryByRole('button', { name: 'copy' })).toBeNull();
  });

  it('reveals copy when focus lands anywhere inside the message, not on copy itself', () => {
    render(<AssistantText text="hello" sessionId={null} />);
    const copyButton = screen.getByRole('button', { name: 'copy' });
    const revealWrapper = copyButton.parentElement as HTMLElement;

    expect(revealWrapper.className).toContain('group-focus-within:opacity-100');
    expect(revealWrapper.className).not.toContain('focus-visible:');
  });
});
