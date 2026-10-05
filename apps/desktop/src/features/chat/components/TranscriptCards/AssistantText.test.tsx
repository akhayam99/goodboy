// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

const { extractAllCommentResolvedMock, extractScribeTextMock } = vi.hoisted(() => ({
  extractAllCommentResolvedMock: vi.fn(() => [] as ReadonlyArray<{ threadId: string }>),
  extractScribeTextMock: vi.fn(() => ({
    prTitle: null as string | null,
    prBody: null as string | null,
    commitMessages: [] as ReadonlyArray<{ sha: string; message: string }>,
    changelogEntry: null as string | null,
  })),
}));

vi.mock('@goodboy/core', () => ({
  extractAllCommentResolved: extractAllCommentResolvedMock,
  extractScribeText: extractScribeTextMock,
  isReviewThreadId: (threadId: string) => threadId.startsWith('PRRT_'),
  stripControlMarkers: (text: string) => text,
}));

vi.mock('@goodboy/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@goodboy/ui')>()),
  CopyButton: () => <button type="button">copy</button>,
  Markdown: ({ text }: { text: string }) => <div>{text}</div>,
}));

vi.mock('../HandoffChip', () => ({ HandoffChip: () => null }));
vi.mock('../PlanChip', () => ({ PlanChip: () => null }));
vi.mock('../ResolverThreadsCard', () => ({ ResolverThreadsCard: () => null }));
vi.mock('../ScribeTextCard', () => ({
  ScribeTextCard: () => <div data-testid="scribe-text-card" />,
}));
import type { AgentId, SessionId } from '@goodboy/types';
import { AssistantText } from './AssistantText';

afterEach(cleanup);

describe('AssistantText', () => {
  it('renders prose bare on the page, with no box around it', () => {
    const { container } = render(<AssistantText text="assistant response" sessionId={null} />);
    const root = container.firstElementChild!;

    expect(root.className).toBe('group relative flex flex-col gap-2 text-prose');
  });

  it('keeps prose on the comfortable reading grade while chrome around it compresses', () => {
    const { container } = render(<AssistantText text="assistant response" sessionId={null} />);
    const root = container.firstElementChild!;

    expect(root.className).toContain('text-prose');
    expect(root.className).not.toContain('text-label');
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

  it('draws the pull request text card under a message that carries the blocks, and only then', () => {
    const agentId = 'agent-scribe' as AgentId;
    const sessionId = 'session-ledger' as SessionId;
    render(<AssistantText text="Done." sessionId={sessionId} agentId={agentId} />);
    expect(screen.queryByTestId('scribe-text-card')).toBeNull();
    cleanup();

    extractScribeTextMock.mockReturnValueOnce({
      prTitle: 'Guard settlement postings',
      prBody: null,
      commitMessages: [],
      changelogEntry: null,
    });
    render(<AssistantText text="blocks" sessionId={sessionId} agentId={agentId} />);

    expect(screen.getByTestId('scribe-text-card')).toBeDefined();
  });
});
