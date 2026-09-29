// @vitest-environment happy-dom

import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Session } from '@goodboy/types';

const { store } = vi.hoisted(() => ({
  store: {
    sessionGithub: {},
    sessionExternalTasks: {},
    sessionArtifacts: {} as Record<string, ReadonlyArray<{ readonly kind: string }>>,
    diffComments: {},
    sessionResolveQueueItems: {} as Record<
      string,
      ReadonlyArray<{
        readonly item: Record<string, unknown>;
        readonly thread: Record<string, unknown>;
      }>
    >,
    sessionResolveAttempts: {},
    sessionResolvePublications: {},
    sessionOpenQuestions: {} as Record<string, ReadonlyArray<unknown>>,
    goodboyNamedSessionId: null as string | null,
  },
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  useAppStore: <T,>(selector: (state: typeof store) => T) => selector(store),
  useSessionOpenQuestions: (id: string) => store.sessionOpenQuestions[id] ?? [],
}));

vi.mock('../../hooks/useSessionTitleRename', () => ({
  useSessionTitleRename: () => ({
    editing: false,
    draft: '',
    maxLength: 60,
    error: null,
    start: vi.fn(),
    setDraft: vi.fn(),
    commit: vi.fn(),
    onKeyDown: vi.fn(),
  }),
}));

vi.mock('./SessionDestructiveActions', () => ({
  SessionDestructiveActions: () => (
    <>
      <button aria-label="Archive session" />
      <button aria-label="Delete session" />
    </>
  ),
}));
vi.mock('./SessionRefreshAction', () => ({
  SessionRefreshAction: () => <button aria-label="Refresh" />,
}));
vi.mock('./ArchivedRestore', () => ({ ArchivedRestore: () => <button>Restore</button> }));
vi.mock('./ChatOriginRow', () => ({ ChatOriginRow: () => null }));
vi.mock('./ContextChip', () => ({ ContextChip: () => <span>Context</span> }));
vi.mock('./GoalTeaser', () => ({
  GoalTeaser: () => <button type="button">Goal: Keep the ledger balanced</button>,
}));
vi.mock('./SessionCostChip', () => ({
  SessionCostChip: () => <span data-testid="session-cost-chip" />,
}));
vi.mock('./LinkedWorkChips', () => ({ LinkedWorkChips: () => <span>Linked work</span> }));
vi.mock('./LinkIssueAction', () => ({ LinkIssueAction: () => <button>Link work</button> }));
vi.mock('./ProjectMountRows', () => ({
  ProjectMountRows: () => <section aria-label="Projects" />,
}));
vi.mock('@goodboy/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@goodboy/ui')>();
  return { ...actual, Tooltip: ({ children }: { readonly children: ReactNode }) => children };
});

import { HeaderBand } from './HeaderBand';

afterEach(cleanup);

const session = {
  id: 'session-1',
  workspaceId: 'workspace-1',
  goal: 'Refactor auth',
} as Session;

describe('HeaderBand', () => {
  beforeEach(() => {
    store.sessionArtifacts = {};
    store.sessionOpenQuestions = {};
    store.sessionResolveQueueItems = {};
    store.goodboyNamedSessionId = null;
  });

  it('marks a title Goodboy wrote at the start until the user renames it', () => {
    store.goodboyNamedSessionId = 'session-1';
    const { unmount } = render(<HeaderBand session={session} onSelectLens={vi.fn()} />);
    expect(screen.getByText('Named by Goodboy')).toBeDefined();
    unmount();

    render(<HeaderBand session={{ ...session, titleUserEdited: true }} onSelectLens={vi.fn()} />);
    expect(screen.queryByText('Named by Goodboy')).toBeNull();
  });

  it('offers Link work on a live session and drops it once archived', () => {
    const { unmount } = render(<HeaderBand session={session} onSelectLens={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Link work' })).toBeDefined();
    unmount();

    render(
      <HeaderBand
        session={{ ...session, archivedAt: '2026-09-28T09:00:00.000Z' } as Session}
        onSelectLens={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Link work' })).toBeNull();
  });

  it('stays clear of attention chips when nothing is waiting', () => {
    render(<HeaderBand session={session} onSelectLens={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /Artifacts/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Questions/ })).toBeNull();
  });

  it('counts the artifacts this session wrote and opens their page', () => {
    store.sessionArtifacts = {
      'session-1': [{ kind: 'report' }, { kind: 'wireframe' }, { kind: 'plan' }],
    };
    store.sessionOpenQuestions = { 'session-1': [{ id: 'q1', status: 'open' }] };
    const onSelectLens = vi.fn();
    render(<HeaderBand session={session} onSelectLens={onSelectLens} />);

    const chip = screen.getByRole('button', { name: /Artifacts/ });
    expect(chip.textContent).toContain('2');

    fireEvent.click(chip);
    expect(onSelectLens).toHaveBeenCalledWith('plans');

    fireEvent.click(screen.getByRole('button', { name: /Questions/ }));
    expect(onSelectLens).toHaveBeenCalledWith('questions');
  });

  it('counts the review comments waiting on the user and opens their page', () => {
    store.sessionResolveQueueItems = {
      'session-1': [
        {
          item: {
            id: 'queue-1',
            threadId: 'thread-1',
            approvalState: 'none',
            approvedRevision: null,
            integratedSha: 'a1b2c3d',
            deliveredAt: null,
          },
          thread: {
            id: 'resolve-thread-1',
            threadId: 'thread-1',
            state: 'open',
            stage: 'proposed',
            stateReason: null,
            revision: 1,
            activeAttemptId: null,
            replyDraft: null,
            commitShas: null,
            question: null,
            createdAt: 1_760_000_000_000,
          },
        },
      ],
    };
    const onSelectLens = vi.fn();
    render(<HeaderBand session={session} onSelectLens={onSelectLens} />);

    const chip = screen.getByRole('button', { name: /Review/ });
    expect(chip.textContent).toContain('1');

    fireEvent.click(chip);
    expect(onSelectLens).toHaveBeenCalledWith('review');
  });

  it('keeps only refresh, archive and delete in the title action zone, in that order', () => {
    render(<HeaderBand session={session} onSelectLens={vi.fn()} />);

    const refresh = screen.getByRole('button', { name: 'Refresh' });
    const archive = screen.getByRole('button', { name: 'Archive session' });
    expect(screen.getByRole('button', { name: 'Delete session' })).toBeDefined();
    expect(
      refresh.compareDocumentPosition(archive) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Scripts' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Open worktree' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mount a project' })).toBeNull();
  });

  it('drops refresh from an archived session', () => {
    render(
      <HeaderBand
        session={{ ...session, archivedAt: '2026-09-01T00:00:00.000Z' } as Session}
        onSelectLens={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Refresh' })).toBeNull();
  });

  it('reads the goal line before the chips and the projects', () => {
    render(<HeaderBand session={session} onSelectLens={vi.fn()} />);

    const goal = screen.getByRole('button', { name: /^Goal:/ });
    const context = screen.getByText('Context');
    const projects = screen.getByRole('region', { name: 'Projects' });
    expect(goal.compareDocumentPosition(context) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(
      context.compareDocumentPosition(projects) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('separates the title zone with rhythm instead of a rule', () => {
    render(<HeaderBand session={session} onSelectLens={vi.fn()} />);

    expect(screen.queryAllByRole('separator')).toHaveLength(0);
  });

  it('renders a backticked title as inline code without the backticks', () => {
    const marked = { ...session, goal: 'run `/explore` first' } as Session;
    render(<HeaderBand session={marked} onSelectLens={vi.fn()} />);

    const title = screen.getByRole('button', { name: /run/ });
    expect(title.querySelector('code')?.textContent).toBe('/explore');
    expect(title.textContent).not.toContain('`');
  });

  it('falls back to one untitled label when the session carries no title', () => {
    const untitled = { ...session, goal: '   ' } as Session;
    render(<HeaderBand session={untitled} onSelectLens={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Untitled session' })).toBeDefined();
  });

  it('renders the session cost at the right edge of the context row', () => {
    render(<HeaderBand session={session} onSelectLens={vi.fn()} />);

    const context = screen.getByText('Context');
    const chip = screen.getByTestId('session-cost-chip');
    const contextRow = context.parentElement?.parentElement;
    expect(contextRow?.lastElementChild?.lastElementChild).toBe(chip);
    expect(contextRow?.contains(context)).toBe(true);
  });
});
