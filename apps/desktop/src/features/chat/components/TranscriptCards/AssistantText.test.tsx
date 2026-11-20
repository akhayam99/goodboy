// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const { extractAllCommentResolvedMock, extractScribeTextMock } = vi.hoisted(() => ({
  extractAllCommentResolvedMock: vi.fn(() => [] as ReadonlyArray<{ threadId: string }>),
  extractScribeTextMock: vi.fn(() => ({
    prTitle: null as string | null,
    prBody: null as string | null,
    commitMessages: [] as ReadonlyArray<{ sha: string; message: string }>,
    changelogEntry: null as string | null,
  })),
}));

vi.mock('@goodboy/core/context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@goodboy/core/context')>()),
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
import { brandId, type AgentId, type SessionId } from '@goodboy/types';
import { AssistantText } from './AssistantText';
import { ObjectMenuContext } from '../../../actions/components/ObjectMenuProvider/objectMenuContext';
import { TranscriptViewingContext } from '../../transcriptViewingContext';

afterEach(cleanup);

describe('AssistantText', () => {
  it('renders prose bare on the page, with no box around it', () => {
    const { container } = render(<AssistantText text="assistant response" sessionId={null} />);
    const root = container.firstElementChild!;

    expect(root.className).toBe('group/row relative flex flex-col gap-2 text-prose');
  });

  it('keeps prose on the comfortable reading grade while chrome around it compresses', () => {
    const { container } = render(<AssistantText text="assistant response" sessionId={null} />);
    const root = container.firstElementChild!;

    expect(root.className).toContain('text-prose');
    expect(root.className).not.toContain('text-meta');
  });

  it('hides copy when a non-first resolved marker belongs to a review thread', () => {
    extractAllCommentResolvedMock.mockReturnValueOnce([
      { threadId: 'local-1' },
      { threadId: 'PRRT_2' },
    ]);
    render(<AssistantText text="assistant response" sessionId={null} />);

    expect(screen.queryByRole('button', { name: 'copy' })).toBeNull();
  });

  it('draws no copy row under the message: the button sits in one wrapper that ends it', () => {
    const { container } = render(<AssistantText text="hello" sessionId={null} />);
    const copyButton = screen.getByRole('button', { name: 'copy' });
    const wrapper = copyButton.parentElement;

    expect(wrapper?.hasAttribute('data-message-meta')).toBe(true);
    expect(container.firstElementChild?.lastElementChild).toBe(wrapper);
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

  it('tells the menu which agent the page shows, and nothing in a chat', () => {
    const agentId = brandId<AgentId>({ value: 'agent-ledger-core' });
    const sessionId = brandId<SessionId>({ value: 'session-ledger' });
    const open = vi.fn();
    const viewing = { kind: 'agent', id: agentId } as const;
    const { container } = render(
      <ObjectMenuContext.Provider value={{ open }}>
        <TranscriptViewingContext.Provider value={viewing}>
          <AssistantText text="Settled." sessionId={sessionId} agentId={agentId} />
        </TranscriptViewingContext.Provider>
      </ObjectMenuContext.Provider>,
    );
    fireEvent.contextMenu(container.firstElementChild!);
    expect(open).toHaveBeenLastCalledWith(expect.objectContaining({ viewing }));
    cleanup();

    const inChat = render(
      <ObjectMenuContext.Provider value={{ open }}>
        <AssistantText text="Settled." sessionId={sessionId} agentId={agentId} />
      </ObjectMenuContext.Provider>,
    );
    fireEvent.contextMenu(inChat.container.firstElementChild!);
    expect(open).toHaveBeenLastCalledWith(expect.objectContaining({ viewing: null }));
  });
});
