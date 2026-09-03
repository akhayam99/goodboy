// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { FileDiff, IsoDateTime, PrReviewDraft, Session } from '@goodboy/types';

const h = vi.hoisted(() => {
  const state = {
    reviewDrafts: {} as Record<string, ReadonlyArray<unknown>>,
    sessionPhaseRuns: {} as Record<string, ReadonlyArray<unknown>>,
    sessionGithub: {} as Record<string, unknown>,
    diffComments: {} as Record<string, ReadonlyArray<unknown>>,
    sessionPendingResolutions: {} as Record<string, ReadonlyArray<unknown>>,
    sessionResolvedThreads: {} as Record<string, ReadonlyArray<unknown>>,
    resolverState: {} as Record<string, unknown>,
    agentKindOverride: {} as Record<string, unknown>,
    agentDraft: {} as Record<string, string>,
    reviewLensIntent: null as { sessionId: string; agentId: string } | null,
    setReviewLensIntent: vi.fn(),
    loadReviewDrafts: vi.fn(async () => undefined),
    addReviewDraft: vi.fn(async () => undefined),
    updateReviewDraft: vi.fn(async () => undefined),
    discardReviewDraft: vi.fn(async () => undefined),
    publishPrReview: vi.fn(async () => ({ published: 1, stale: [], failed: [], mismatched: [] })),
    setAgentDraft: vi.fn(),
    selectAgent: vi.fn(async () => undefined),
  };
  const useAppStore = Object.assign(<T,>(selector: (s: typeof state) => T) => selector(state), {
    getState: () => state,
  });
  return {
    state,
    useAppStore,
    showToast: vi.fn(),
    diff: {
      files: [] as ReadonlyArray<FileDiff>,
      loading: false,
      error: null as string | null,
      target: { provider: 'github', repo: 'acme/web', prNumber: 41 } as {
        provider: 'github' | 'gitlab';
        repo: string;
        prNumber: number;
      } | null,
      refresh: vi.fn(),
    },
  };
});

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  useAppStore: h.useAppStore,
  useDiffComments: (sessionId: string) => h.state.diffComments[sessionId] ?? [],
}));

vi.mock('./useReviewDiff', () => ({
  useReviewDiff: () => h.diff,
}));

vi.mock('../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast: h.showToast }),
}));

vi.mock('./ThreadsSection', () => ({
  ThreadsSection: () => <div data-testid="threads-section">Threads section</div>,
}));

vi.mock('./ResolversSection', () => ({
  ResolversSection: () => <div data-testid="resolvers-section">Resolvers section</div>,
}));

vi.mock('@goodboy/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@goodboy/ui')>();
  return {
    ...actual,
    ScrollFade: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  };
});

import { ReviewBoardPane } from './index';

const SESSION = { id: 'session-1', workspaceId: 'workspace-1' } as unknown as Session;

const FILE: FileDiff = {
  path: 'src/auth.ts',
  status: 'modified',
  additions: 1,
  deletions: 0,
  binary: false,
  hunks: [
    {
      header: '@@ -3,2 +3,3 @@',
      oldStart: 3,
      oldLines: 2,
      newStart: 3,
      newLines: 3,
      lines: [
        { kind: 'context', oldLine: 3, newLine: 3, text: 'const session = load();' },
        { kind: 'add', oldLine: null, newLine: 4, text: 'retry(session);' },
      ],
    },
  ],
};

const DRAFT: PrReviewDraft = {
  id: 'draft-1',
  sessionId: SESSION.id,
  provider: 'github',
  repo: 'acme/web',
  prNumber: 41,
  path: 'src/auth.ts',
  line: 4,
  startLine: null,
  side: 'new',
  body: 'Guard against a null session here.',
  status: 'draft',
  stale: false,
  origin: 'agent',
  createdAt: '2026-07-22T10:00:00Z' as IsoDateTime,
};

beforeEach(() => {
  h.state.reviewDrafts = { 'session-1': [DRAFT] };
  h.state.sessionPhaseRuns = {
    'session-1': [{ id: 'agent-1', name: 'pr review', kind: 'pr-reviewer' }],
  };
  h.state.sessionGithub = {};
  h.state.diffComments = {};
  h.state.sessionPendingResolutions = {};
  h.state.sessionResolvedThreads = {};
  h.state.resolverState = {};
  h.state.agentKindOverride = {};
  h.state.agentDraft = {};
  h.state.reviewLensIntent = null;
  h.state.setReviewLensIntent.mockClear();
  h.diff.files = [FILE];
  h.diff.loading = false;
  h.diff.error = null;
  h.diff.target = { provider: 'github', repo: 'acme/web', prNumber: 41 };
  h.state.loadReviewDrafts.mockClear();
  h.state.addReviewDraft.mockClear();
  h.state.updateReviewDraft.mockClear();
  h.state.discardReviewDraft.mockClear();
  h.state.publishPrReview.mockClear();
  h.state.publishPrReview.mockResolvedValue({
    published: 1,
    stale: [],
    failed: [],
    mismatched: [],
  });
  h.state.setAgentDraft.mockClear();
  h.showToast.mockClear();
  h.diff.refresh.mockClear();
  localStorage.clear();
});

afterEach(cleanup);

describe('ReviewBoardPane', () => {
  it('loads drafts on mount and renders them with edit and discard', async () => {
    render(<ReviewBoardPane session={SESSION} />);

    expect(h.state.loadReviewDrafts).toHaveBeenCalledWith('session-1');
    fireEvent.click(screen.getByRole('button', { name: 'Guard against a null session here.' }));
    const editor = screen.getByRole('textbox', { name: 'Edit draft comment' });
    fireEvent.change(editor, { target: { value: 'Guard the session, then retry.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(h.state.updateReviewDraft).toHaveBeenCalledWith(
      'draft-1',
      'Guard the session, then retry.',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Discard draft on src/auth.ts:4' }));
    expect(h.state.discardReviewDraft).toHaveBeenCalledWith('draft-1');
  });

  it('adds a user draft from a diff line composer', async () => {
    render(<ReviewBoardPane session={SESSION} />);

    fireEvent.click(screen.getByRole('button', { name: 'Draft a comment on line 3' }));
    const composer = screen.getByRole('textbox', { name: 'Draft comment body' });
    fireEvent.change(composer, { target: { value: 'Load lazily instead.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add draft' }));

    await waitFor(() => {
      expect(h.state.addReviewDraft).toHaveBeenCalledWith({
        sessionId: 'session-1',
        path: 'src/auth.ts',
        line: 3,
        side: 'new',
        body: 'Load lazily instead.',
      });
    });
  });

  it('prefills the reviewer chat draft from the ask agent action', () => {
    render(<ReviewBoardPane session={SESSION} />);

    fireEvent.click(screen.getByRole('button', { name: 'Ask the agent about line 4' }));

    expect(h.state.setAgentDraft).toHaveBeenCalledWith(
      'agent-1',
      'About `src/auth.ts:4`:\n> retry(session);\n',
    );
    expect(h.state.selectAgent).toHaveBeenCalledWith('session-1', 'agent-1');
  });

  it('publishes with the chosen verdict and disables while pending', async () => {
    let resolvePublish: (value: {
      published: number;
      stale: never[];
      failed: never[];
      mismatched: never[];
    }) => void = () => undefined;
    h.state.publishPrReview.mockReturnValue(
      new Promise((resolve) => {
        resolvePublish = resolve;
      }),
    );
    render(<ReviewBoardPane session={SESSION} />);

    fireEvent.change(screen.getByRole('combobox', { name: 'Review verdict' }), {
      target: { value: 'request_changes' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Publish review (1)' }));

    expect(h.state.publishPrReview).toHaveBeenCalledWith('session-1', {
      verdict: 'request_changes',
      body: '',
    });
    const pending = await screen.findByRole('button', { name: 'Publishing…' });
    expect(pending.hasAttribute('disabled')).toBe(true);

    resolvePublish({ published: 1, stale: [], failed: [], mismatched: [] });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Publish review (1)' })).toBeDefined();
    });
  });

  it('hides the verdict select for gitlab and explains the summary note', () => {
    h.diff.target = { provider: 'gitlab', repo: 'acme/web', prNumber: 41 };
    render(<ReviewBoardPane session={SESSION} />);

    expect(screen.queryByRole('combobox', { name: 'Review verdict' })).toBeNull();
    expect(
      screen.getByText('Comments post as merge request discussions; the summary posts as a note.'),
    ).toBeDefined();
  });

  it('explains the flow when there are no drafts yet', () => {
    h.state.reviewDrafts = { 'session-1': [] };
    render(<ReviewBoardPane session={SESSION} />);

    expect(screen.getByText('No draft comments yet')).toBeDefined();
    expect(
      screen.getByText('Ask the agent to draft comments, or click a diff line.'),
    ).toBeDefined();
  });

  it('switches the diff to split and remembers the choice', () => {
    render(<ReviewBoardPane session={SESSION} />);

    fireEvent.click(screen.getByRole('tab', { name: 'Split' }));

    expect(localStorage.getItem('goodboy:diff-layout-mode')).toBe('split');
    expect(screen.getByLabelText('Draft a comment on new line 4')).toBeDefined();
  });

  it('rehydrates the split layout from the stored preference', () => {
    localStorage.setItem('goodboy:diff-layout-mode', 'split');
    render(<ReviewBoardPane session={SESSION} />);

    expect(screen.getByRole('tab', { name: 'Split' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByLabelText('Draft a comment on new line 4')).toBeDefined();
  });

  it('states its section title with the reviewed record below it', () => {
    render(<ReviewBoardPane session={SESSION} />);

    const title = screen.getByRole('heading', { level: 2, name: 'Review board' });
    const record = screen.getByText('acme/web #41');
    const layoutControl = screen.getByRole('tab', { name: 'Unified' });

    expect(title.className).toContain('text-xl');
    expect(title.parentElement?.contains(layoutControl)).toBe(true);
    expect(title.compareDocumentPosition(record) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('states its section title with no reviewed record', () => {
    h.diff.target = null;
    render(<ReviewBoardPane session={SESSION} />);

    expect(screen.getByRole('heading', { name: 'Review board' })).toBeDefined();
    expect(screen.queryByText('acme/web #41')).toBeNull();
  });

  it('offers a retry when the diff fails to load', () => {
    h.diff.error = 'network unreachable';
    render(<ReviewBoardPane session={SESSION} />);

    expect(screen.getByText(/network unreachable/)).toBeDefined();
    const retry = screen.getByRole('button', { name: 'Retry' });
    fireEvent.click(retry);
    expect(h.diff.refresh).toHaveBeenCalled();
  });

  it('switches between review, threads, and resolver sections', () => {
    render(<ReviewBoardPane session={SESSION} />);

    fireEvent.click(screen.getByRole('tab', { name: /Threads/ }));
    expect(screen.getByTestId('threads-section')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Publish review (1)' })).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: /Resolvers/ }));
    expect(screen.getByTestId('resolvers-section')).toBeDefined();

    fireEvent.click(screen.getByRole('tab', { name: 'Review' }));
    expect(screen.getByRole('button', { name: 'Publish review (1)' })).toBeDefined();
  });

  it('opens the resolvers section and clears the intent when a resolver inspect is requested', () => {
    h.state.reviewLensIntent = { sessionId: 'session-1', agentId: 'resolver-9' };

    render(<ReviewBoardPane session={SESSION} />);

    expect(screen.getByTestId('resolvers-section')).toBeDefined();
    expect(h.state.setReviewLensIntent).toHaveBeenCalledWith({ intent: null });
  });

  it('ignores a resolver inspect intent aimed at another session', () => {
    h.state.reviewLensIntent = { sessionId: 'session-2', agentId: 'resolver-9' };

    render(<ReviewBoardPane session={SESSION} />);

    expect(screen.queryByTestId('resolvers-section')).toBeNull();
    expect(h.state.setReviewLensIntent).not.toHaveBeenCalled();
  });

  it('shows open thread and active resolver counts in tab badges', () => {
    h.state.sessionGithub = {
      'session-1': {
        detail: {
          comments: [
            {
              id: 'comment-1',
              source: 'review',
              threadId: 'thread-1',
              resolved: false,
              outdated: false,
              url: 'https://example.test/thread-1',
            },
          ],
        },
      },
    };
    h.state.diffComments = {
      'session-1': [{ id: 'diff-1', status: 'open' }],
    };
    h.state.sessionPhaseRuns = {
      'session-1': [
        {
          id: 'resolver-1',
          name: 'resolver',
          kind: 'resolver',
          status: 'running',
          ordinal: 1,
          parentAgentId: null,
          stepId: null,
        },
      ],
    };

    render(<ReviewBoardPane session={SESSION} />);

    expect(screen.getByRole('tab', { name: /Threads.*2/ })).toBeDefined();
    expect(screen.getByRole('tab', { name: /Resolvers.*1/ })).toBeDefined();
  });
});
