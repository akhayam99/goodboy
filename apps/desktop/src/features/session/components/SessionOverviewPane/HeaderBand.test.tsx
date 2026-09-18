// @vitest-environment happy-dom

import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Session } from '@goodboy/types';

const { store } = vi.hoisted(() => ({
  store: {
    pendingTitleFocusSessionId: null as string | null,
    clearPendingTitleFocus: vi.fn(),
    sessionGithub: {},
    sessionExternalTasks: {},
    sessionArtifacts: {} as Record<string, ReadonlyArray<{ readonly kind: string }>>,
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
vi.mock('./ContextChip', () => ({ ContextChip: () => <span>Context</span> }));
vi.mock('./ContextDigest', () => ({
  ContextDigest: () => <section aria-label="Context digest" />,
}));
vi.mock('./SessionCostChip', () => ({
  SessionCostChip: () => <span data-testid="session-cost-chip" />,
}));
vi.mock('./LinkedWorkChips', () => ({ LinkedWorkChips: () => <span>Linked work</span> }));
vi.mock('./LinkIssueAction', () => ({ LinkIssueAction: () => <button>Link issue</button> }));
vi.mock('./ProjectMountRows', () => ({
  ProjectMountRows: () => <section aria-label="Mounted projects" />,
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
    store.pendingTitleFocusSessionId = null;
    store.clearPendingTitleFocus.mockClear();
    store.sessionArtifacts = {};
    store.sessionOpenQuestions = {};
    store.sessionResolveQueueItems = {};
  });

  it('stays clear of attention chips when nothing is waiting', () => {
    render(<HeaderBand session={session} onSelectLens={vi.fn()} goal={<div>Goal</div>} />);

    expect(screen.queryByRole('button', { name: /Artifacts/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Questions/ })).toBeNull();
  });

  it('counts the artifacts this session wrote and opens their page', () => {
    store.sessionArtifacts = {
      'session-1': [{ kind: 'report' }, { kind: 'wireframe' }, { kind: 'plan' }],
    };
    store.sessionOpenQuestions = { 'session-1': [{ id: 'q1', status: 'open' }] };
    const onSelectLens = vi.fn();
    render(<HeaderBand session={session} onSelectLens={onSelectLens} goal={<div>Goal</div>} />);

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
    render(<HeaderBand session={session} onSelectLens={onSelectLens} goal={<div>Goal</div>} />);

    const chip = screen.getByRole('button', { name: /Review/ });
    expect(chip.textContent).toContain('1');

    fireEvent.click(chip);
    expect(onSelectLens).toHaveBeenCalledWith('review');
  });

  it('keeps only archive and delete in the title action zone', () => {
    render(<HeaderBand session={session} onSelectLens={vi.fn()} goal={<div>Goal</div>} />);

    expect(screen.getByRole('button', { name: 'Archive session' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Delete session' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Scripts' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Open worktree' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mount a project' })).toBeNull();
  });

  it('renders mounted projects before the goal', () => {
    render(<HeaderBand session={session} onSelectLens={vi.fn()} goal={<div>Goal</div>} />);

    const projects = screen.getByRole('region', { name: 'Mounted projects' });
    const goal = screen.getByText('Goal');
    expect(projects.compareDocumentPosition(goal) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('closes the title and context zone with one divider before the sections', () => {
    render(<HeaderBand session={session} onSelectLens={vi.fn()} goal={<div>Goal</div>} />);

    const divider = screen.getByRole('separator');
    const projects = screen.getByRole('region', { name: 'Mounted projects' });
    expect(
      divider.compareDocumentPosition(projects) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getAllByRole('separator')).toHaveLength(1);
  });

  it('renders a backticked title as inline code without the backticks', () => {
    const marked = { ...session, goal: 'run `/explore` first' } as Session;
    render(<HeaderBand session={marked} onSelectLens={vi.fn()} goal={<div>Goal</div>} />);

    const title = screen.getByRole('button', { name: /run/ });
    expect(title.querySelector('code')?.textContent).toBe('/explore');
    expect(title.textContent).not.toContain('`');
  });

  it('puts the decisions and summary digest after the goal', () => {
    render(<HeaderBand session={session} onSelectLens={vi.fn()} goal={<div>Goal</div>} />);

    const goal = screen.getByText('Goal');
    const digest = screen.getByRole('region', { name: 'Context digest' });
    expect(goal.compareDocumentPosition(digest) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('falls back to one untitled label when the session carries no title', () => {
    const untitled = { ...session, goal: '   ' } as Session;
    render(<HeaderBand session={untitled} onSelectLens={vi.fn()} goal={<div>Goal</div>} />);

    expect(screen.getByRole('button', { name: 'Untitled session' })).toBeDefined();
  });

  it('renders the session cost at the right edge of the context row', () => {
    render(<HeaderBand session={session} onSelectLens={vi.fn()} goal={<div>Goal</div>} />);

    const context = screen.getByText('Context');
    const chip = screen.getByTestId('session-cost-chip');
    const contextRow = context.parentElement?.parentElement;
    expect(contextRow?.lastElementChild?.lastElementChild).toBe(chip);
    expect(contextRow?.contains(context)).toBe(true);
  });
});
