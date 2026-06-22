// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { OpenQuestion, Session, SessionStageInfo, Workspace } from '@goodboy/types';
import type { FilesTouched } from '../../../../store';

type Store = {
  sessionBranches: Record<string, string>;
  spawnAgent: ReturnType<typeof vi.fn>;
  sessionPhaseRuns: Record<string, ReadonlyArray<unknown>>;
  scriptRuns: Record<string, Record<string, { status: string }>>;
  sessionGithub: Record<string, { pr?: unknown }>;
  sessionGitlabMr: Record<string, { mr?: unknown }>;
};

const { store, hooks } = vi.hoisted(() => ({
  store: {
    sessionBranches: {} as Record<string, string>,
    spawnAgent: vi.fn(async () => undefined),
    sessionPhaseRuns: {} as Record<string, ReadonlyArray<unknown>>,
    scriptRuns: {} as Record<string, Record<string, { status: string }>>,
    sessionGithub: {} as Record<string, { pr?: unknown }>,
    sessionGitlabMr: {} as Record<string, { mr?: unknown }>,
  } as Store,
  hooks: {
    workspace: { name: 'My workspace' } as Workspace | null,
    openQuestions: [] as ReadonlyArray<OpenQuestion>,
    plans: [] as ReadonlyArray<{ status: string }>,
    stage: { stage: 'building', reason: '' } as SessionStageInfo,
  },
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  useAppStore: <T,>(selector: (s: Store) => T) => selector(store),
  useCurrentWorkspace: () => hooks.workspace,
  useSessionOpenQuestions: () => hooks.openQuestions,
  useSessionPlans: () => hooks.plans,
  useSessionStageInfo: () => hooks.stage,
}));

vi.mock('../../../../shared/components/ScrollFade', () => ({
  ScrollFade: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../../workspace/components/SessionDetailPanel/SummarizerBadge', () => ({
  SummarizerBadge: () => <span data-testid="summarizer-badge" />,
}));

vi.mock('./BranchChip', () => ({
  BranchChip: ({ branch }: { branch: string }) => <span data-testid="branch-chip">{branch}</span>,
}));

vi.mock('./SessionCostChip', () => ({
  SessionCostChip: () => <span data-testid="cost-chip" />,
}));

import { SessionOverviewPane } from './index';

const standaloneAgent = (status = 'running') => ({
  parentAgentId: null,
  workflowRunId: null,
  stepId: null,
  status,
});

const baseSession = (over: Partial<Session> = {}): Session =>
  ({
    id: 'sess-1',
    goal: 'refactor auth',
    createdAt: '2026-06-22T10:00:00.000Z',
    workflowRuns: [],
    ...over,
  }) as unknown as Session;

const files: FilesTouched = { count: 3 } as unknown as FilesTouched;

const renderPane = (session = baseSession(), onSelectLens = vi.fn(), filesTouched = files) => {
  render(
    <SessionOverviewPane
      session={session}
      filesTouched={filesTouched}
      onSelectLens={onSelectLens}
    />,
  );
  return onSelectLens;
};

beforeEach(() => {
  store.sessionBranches = {};
  store.spawnAgent.mockReset();
  store.spawnAgent.mockResolvedValue(undefined);
  store.sessionPhaseRuns = {};
  store.scriptRuns = {};
  store.sessionGithub = {};
  store.sessionGitlabMr = {};
  hooks.workspace = { name: 'My workspace' } as Workspace;
  hooks.openQuestions = [];
  hooks.plans = [];
  hooks.stage = { stage: 'building', reason: '' } as SessionStageInfo;
});
afterEach(cleanup);

describe('SessionOverviewPane header meta (cluster A)', () => {
  it('renders the goal, stage label and workspace name', () => {
    hooks.stage = { stage: 'building', reason: 'agents are working' } as SessionStageInfo;
    renderPane();
    expect(screen.getByRole('heading', { name: /refactor auth/i })).toBeDefined();
    expect(screen.getByText('Building')).toBeDefined();
    expect(screen.getByText('agents are working')).toBeDefined();
    expect(screen.getByText('My workspace')).toBeDefined();
  });

  it('falls back to Untitled session when the goal is blank', () => {
    renderPane(baseSession({ goal: '' }));
    expect(screen.getByRole('heading', { name: /untitled session/i })).toBeDefined();
  });

  it('shows the branch chip, cost chip, summarizer and session age', () => {
    store.sessionBranches = { 'sess-1': 'ak/feat-thing' };
    renderPane();
    expect(screen.getByTestId('branch-chip').textContent).toBe('ak/feat-thing');
    expect(screen.getByTestId('cost-chip')).toBeDefined();
    expect(screen.getByTestId('summarizer-badge')).toBeDefined();
    expect(screen.getByText(/old$/)).toBeDefined();
  });

  it('omits the branch chip when no branch is known', () => {
    renderPane();
    expect(screen.queryByTestId('branch-chip')).toBeNull();
  });
});

describe('SessionOverviewPane guided empty-state (cluster B)', () => {
  it('shows the get-started CTAs and hides the stats grid when fresh', () => {
    renderPane();
    expect(screen.getByText('Get started')).toBeDefined();
    expect(screen.getByRole('button', { name: /create a workflow/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /spawn an agent/i })).toBeDefined();
    expect(screen.queryByText('At a glance')).toBeNull();
  });

  it('dispatches the workflow-builder event scoped to the session', () => {
    const handler = vi.fn();
    window.addEventListener('goodboy:open-workflow-builder', handler);
    renderPane();
    fireEvent.click(screen.getByRole('button', { name: /create a workflow/i }));
    expect(handler).toHaveBeenCalledOnce();
    expect((handler.mock.calls[0]![0] as CustomEvent).detail).toEqual({ sessionId: 'sess-1' });
    window.removeEventListener('goodboy:open-workflow-builder', handler);
  });

  it('spawns an agent for the session from the second CTA', () => {
    renderPane();
    fireEvent.click(screen.getByRole('button', { name: /spawn an agent/i }));
    expect(store.spawnAgent).toHaveBeenCalledWith('sess-1', {});
  });

  it('treats discarded workflow runs as not active for freshness', () => {
    renderPane(
      baseSession({
        workflowRuns: [{ discardedAt: '2026-06-22T11:00:00.000Z' }],
      } as unknown as Partial<Session>),
    );
    expect(screen.getByText('Get started')).toBeDefined();
  });
});

describe('SessionOverviewPane stats grid', () => {
  beforeEach(() => {
    store.sessionPhaseRuns = { 'sess-1': [standaloneAgent('running')] };
  });

  it('renders the at-a-glance grid and hides the get-started CTAs once work exists', () => {
    renderPane();
    expect(screen.getByText('At a glance')).toBeDefined();
    expect(screen.queryByText('Get started')).toBeNull();
  });

  it('reports running agents as a ratio', () => {
    renderPane();
    expect(screen.getByText('1/1')).toBeDefined();
    expect(screen.getByText('agents running')).toBeDefined();
  });

  it('uses the singular files label for a single change', () => {
    renderPane(baseSession(), vi.fn(), { count: 1 } as unknown as FilesTouched);
    expect(screen.getByText('file changed')).toBeDefined();
  });

  it('selects the lens when a stat card is clicked', () => {
    const onSelectLens = renderPane();
    fireEvent.click(screen.getByText('active workflows'));
    expect(onSelectLens).toHaveBeenCalledWith('workflows');
  });
});

describe('SessionOverviewPane nudges', () => {
  it('surfaces open questions with the first line as detail', () => {
    hooks.openQuestions = [
      { status: 'open', text: 'why this approach?\nmore detail' },
    ] as unknown as ReadonlyArray<OpenQuestion>;
    const onSelectLens = renderPane();
    expect(screen.getByText('1 open question')).toBeDefined();
    expect(screen.getByText('why this approach?')).toBeDefined();
    fireEvent.click(screen.getByText('1 open question'));
    expect(onSelectLens).toHaveBeenCalledWith('questions');
  });

  it('shows the calm fallback when nothing needs the user', () => {
    renderPane();
    expect(screen.getByText(/nothing needs you right now/i)).toBeDefined();
  });

  it('raises an attention nudge for a pull request', () => {
    store.sessionPhaseRuns = { 'sess-1': [standaloneAgent('running')] };
    hooks.stage = { stage: 'attention', reason: 'PR needs review' } as SessionStageInfo;
    renderPane();
    expect(screen.getByText(/pull request needs you/i)).toBeDefined();
  });
});

describe('SessionOverviewPane jump-to links', () => {
  it('selects the goal lens from the jump-to row', () => {
    const onSelectLens = renderPane();
    fireEvent.click(screen.getByRole('button', { name: /^goal$/i }));
    expect(onSelectLens).toHaveBeenCalledWith('goal');
  });
});
