import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { HelpCircle, Play, type LucideIcon } from 'lucide-react';
import type {
  PullRequestState,
  Session,
  SessionExternalTask,
  SessionId,
  SessionPrFetchState,
  SessionStage,
} from '@goodboy/types';
import type { GitlabMergeRequest } from '../../../../integrations/gitlab/client';
import type { BoardNavigation } from '../useBoardNavigation';

type MockDynamicAction = {
  readonly key: string;
  readonly icon: LucideIcon;
  readonly tone: 'primary' | 'warning';
  readonly label: string;
  readonly onClick: () => void;
};

const { state, hooks, useDynamicActionsMock } = vi.hoisted(() => ({
  state: {
    sessionGithub: {} as Record<string, { pr: PullRequestState | null }>,
    sessionGitlabMr: {} as Record<string, { mr: GitlabMergeRequest | null }>,
    sessionExternalTasks: {} as Record<string, ReadonlyArray<SessionExternalTask>>,
    sessionWorktrees: {} as Record<string, ReadonlyArray<string>>,
    sessionProjectMounts: {} as Record<string, ReadonlyArray<unknown>>,
    projects: [] as ReadonlyArray<unknown>,
    sessionPhaseRuns: {} as Record<string, ReadonlyArray<unknown>>,
    reviewDrafts: {} as Record<string, ReadonlyArray<unknown>>,
    loadReviewDrafts: vi.fn(async () => undefined),
    setCurrentSession: vi.fn(async () => undefined),
    setActiveLens: vi.fn(),
  },
  hooks: {
    stage: 'building' as SessionStage,
    reason: 'no PR yet',
    agents: [] as ReadonlyArray<unknown>,
    cost: 0,
    prFetchState: 'known' as SessionPrFetchState,
  },
  useDynamicActionsMock: vi.fn((): ReadonlyArray<MockDynamicAction> => []),
}));

vi.mock('../../../../../store', () => ({
  EMPTY_ARRAY: [] as readonly never[],
  useAppStore: <T,>(selector: (store: typeof state) => T) => selector(state),
  useNonResolverStandaloneAgents: () => hooks.agents,
  useSessionCost: () => hooks.cost,
  useSessionPrFetchState: () => hooks.prFetchState,
  useSessionStageInfo: () => ({ stage: hooks.stage, reason: hooks.reason }),
}));

vi.mock('./useDynamicActions', () => ({
  useDynamicActions: () => useDynamicActionsMock(),
}));

vi.mock('@goodboy/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@goodboy/ui')>();
  return {
    ...actual,
    StatusDot: () => <span data-testid="status-dot" />,
    Tooltip: ({ content, children }: { content: string; children: ReactElement }) => (
      <span data-tooltip={content}>{children}</span>
    ),
  };
});

import { StageBoardCard } from './index';

const SESSION_ID = 'session-1' as SessionId;

const nav = {
  selectCard: vi.fn(),
  openAgent: vi.fn(),
  openTerminal: vi.fn(),
  openIDE: vi.fn(),
  openQuestions: vi.fn(),
  openWorkflows: vi.fn(),
  openGithub: vi.fn(),
  restore: vi.fn(),
} satisfies BoardNavigation;

const session = {
  id: SESSION_ID,
  goal: 'Keep every board card compact',
  workflowRuns: [],
} as unknown as Session;

const pullRequest = {
  number: 9484,
  state: 'draft',
} as unknown as PullRequestState;

type MergeRequestParams = {
  readonly state: string;
  readonly draft?: boolean;
};

const mergeRequest = ({
  state: mergeRequestState,
  draft = false,
}: MergeRequestParams): GitlabMergeRequest =>
  ({
    id: 1,
    iid: 12,
    state: mergeRequestState,
    draft,
  }) as GitlabMergeRequest;

const externalTask = {
  sessionId: SESSION_ID,
  provider: 'linear',
  externalId: 'linear-1',
  identifier: 'GB-123',
  title: 'Compact board cards',
} as SessionExternalTask;

beforeEach(() => {
  state.sessionGithub = {};
  state.sessionGitlabMr = {};
  state.sessionExternalTasks = {};
  state.sessionWorktrees = {};
  state.sessionProjectMounts = {};
  state.projects = [];
  state.sessionPhaseRuns = {};
  state.reviewDrafts = {};
  state.loadReviewDrafts.mockClear();
  state.setCurrentSession.mockClear();
  state.setActiveLens.mockClear();
  useDynamicActionsMock.mockReset();
  useDynamicActionsMock.mockReturnValue([]);
  nav.selectCard.mockClear();
  hooks.reason = 'no PR yet';
  hooks.agents = [];
  hooks.cost = 0;
  hooks.prFetchState = 'known';
});

afterEach(cleanup);

describe('StageBoardCard layout', () => {
  it('uses fixed card and title slots while always rendering the footer row', () => {
    render(<StageBoardCard session={session} nav={nav} />);
    const card = screen.getAllByRole('button')[0];
    const title = screen.getByText(session.goal);
    const footer =
      title.closest('[data-tooltip]')?.parentElement?.nextElementSibling?.nextElementSibling;
    expect(card?.className).toContain('h-[8.25rem]');
    expect(title.className).toContain('line-clamp-2');
    expect(title.className).toContain('min-h-10');
    expect(footer?.className).toContain('flex-nowrap');
    expect(footer?.className).toContain('min-h-5');
  });

  it('shows the reason under the goal and in the title tooltip without a status dot', () => {
    render(<StageBoardCard session={session} nav={nav} />);
    const tooltip = screen.getByText(session.goal).closest('[data-tooltip]');
    expect(tooltip?.getAttribute('data-tooltip')).toBe(`${session.goal} · no PR yet`);
    expect(screen.queryByTestId('status-dot')).toBeNull();
    expect(screen.getByText('no PR yet').className).toContain('truncate');
  });

  it('points at the session with a trailing chevron', () => {
    render(<StageBoardCard session={session} nav={nav} />);
    expect(document.querySelector('.lucide-chevron-right')).not.toBeNull();
  });

  it('renders the last update age when the session carries a timestamp', () => {
    const updated = { ...session, updatedAt: new Date(Date.now() - 7_200_000).toISOString() };
    render(<StageBoardCard session={updated as unknown as Session} nav={nav} />);
    expect(screen.getByText('2h ago')).toBeDefined();
  });
});

describe('StageBoardCard selection', () => {
  it('offers no selection checkbox at all', () => {
    render(<StageBoardCard session={session} nav={nav} onModifierClick={vi.fn()} />);
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('selects on an alt click instead of opening the session', () => {
    const onModifierClick = vi.fn();
    render(<StageBoardCard session={session} nav={nav} onModifierClick={onModifierClick} />);
    fireEvent.click(screen.getAllByRole('button')[0] as HTMLElement, { altKey: true });
    expect(onModifierClick).toHaveBeenCalledWith(SESSION_ID, expect.anything());
    expect(nav.selectCard).not.toHaveBeenCalled();
  });

  it('selects from the keyboard with alt and Enter', () => {
    const onModifierClick = vi.fn();
    render(<StageBoardCard session={session} nav={nav} onModifierClick={onModifierClick} />);
    const card = screen.getAllByRole('button')[0] as HTMLElement;
    expect(card.getAttribute('aria-keyshortcuts')).toBe('Alt+Enter');
    fireEvent.keyDown(card, { key: 'Enter', altKey: true });
    expect(onModifierClick).toHaveBeenCalledWith(SESSION_ID, expect.anything());
    expect(nav.selectCard).not.toHaveBeenCalled();
  });

  it('opens the session on a plain Enter', () => {
    render(<StageBoardCard session={session} nav={nav} onModifierClick={vi.fn()} />);
    fireEvent.keyDown(screen.getAllByRole('button')[0] as HTMLElement, { key: 'Enter' });
    expect(nav.selectCard).toHaveBeenCalledWith(session);
  });

  it('exposes the id the lasso hit-tests against', () => {
    render(<StageBoardCard session={session} nav={nav} />);
    expect((screen.getAllByRole('button')[0] as HTMLElement).getAttribute('data-select-id')).toBe(
      SESSION_ID,
    );
  });

  it('routes a modifier click on the card to selection instead of navigation', () => {
    const onModifierClick = vi.fn();
    render(<StageBoardCard session={session} nav={nav} onModifierClick={onModifierClick} />);
    fireEvent.click(screen.getAllByRole('button')[0] as HTMLElement, { metaKey: true });
    expect(onModifierClick).toHaveBeenCalledWith(SESSION_ID, expect.anything());
    expect(nav.selectCard).not.toHaveBeenCalled();
  });

  it('navigates on a plain click even when selection is available', () => {
    render(<StageBoardCard session={session} nav={nav} onModifierClick={vi.fn()} />);
    fireEvent.click(screen.getAllByRole('button')[0] as HTMLElement);
    expect(nav.selectCard).toHaveBeenCalledWith(session);
  });
});

describe('StageBoardCard linked request', () => {
  it('renders no pull request indicator when no PR exists', () => {
    render(<StageBoardCard session={session} nav={nav} />);
    expect(screen.queryByLabelText('No pull request')).toBeNull();
    expect(screen.queryByLabelText(/open in GitHub/)).toBeNull();
    expect(screen.getByText(session.goal)).toBeTruthy();
  });

  it('renders a clickable GitHub PR button that calls nav.openGithub', () => {
    state.sessionGithub = { [SESSION_ID]: { pr: pullRequest } };
    render(<StageBoardCard session={session} nav={nav} />);
    const btn = screen.getByLabelText('Draft · #9484, open in GitHub');
    expect(btn.tagName).toBe('BUTTON');
    fireEvent.click(btn);
    expect(nav.openGithub).toHaveBeenCalledWith(session);
    expect(screen.queryByLabelText('No pull request')).toBeNull();
  });

  it('renders a clickable GitLab MR button that dispatches the studio event', () => {
    state.sessionGitlabMr = {
      [SESSION_ID]: { mr: mergeRequest({ state: 'opened' }) },
    };
    const dispatched: Event[] = [];
    const onOpenInbox = (event: Event) => dispatched.push(event);
    window.addEventListener('goodboy:open-inbox', onOpenInbox);
    render(<StageBoardCard session={session} nav={nav} />);
    const btn = screen.getByLabelText('Merge request !12 · open, open in GitLab');
    fireEvent.click(btn);
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toMatchObject({
      detail: { provider: 'gitlab', kind: 'mr', recordKey: 'gitlab:mr:1' },
    });
    window.removeEventListener('goodboy:open-inbox', onOpenInbox);
  });

  it('marks the pull request slot as still being checked before GitHub answers', () => {
    hooks.prFetchState = 'unknown';
    render(<StageBoardCard session={session} nav={nav} />);
    expect(screen.getByLabelText('Checking GitHub for a pull request')).toBeTruthy();
    expect(screen.queryByLabelText(/open in GitHub/)).toBeNull();
  });

  it('marks the pull request slot offline when GitHub could not be reached', () => {
    hooks.prFetchState = 'unreachable';
    render(<StageBoardCard session={session} nav={nav} />);
    expect(screen.getByLabelText('Could not reach GitHub, will retry')).toBeTruthy();
    expect(screen.queryByLabelText('Checking GitHub for a pull request')).toBeNull();
  });

  it('leaves the pull request slot empty once a fetch confirms there is none', () => {
    render(<StageBoardCard session={session} nav={nav} />);
    expect(screen.queryByLabelText('Checking GitHub for a pull request')).toBeNull();
    expect(screen.queryByLabelText('Could not reach GitHub, will retry')).toBeNull();
  });

  it('does not render a clickable button when state is none', () => {
    render(<StageBoardCard session={session} nav={nav} />);
    expect(screen.queryByLabelText(/open in GitHub/)).toBeNull();
    expect(screen.queryByLabelText(/open in GitLab/)).toBeNull();
  });

  it.each([
    ['opened', false, 'open'],
    ['open', false, 'open'],
    ['opened', true, 'draft'],
    ['merged', false, 'merged'],
    ['closed', false, 'closed'],
  ])('maps GitLab %s with draft %s to %s', (mrState, draft, expected) => {
    state.sessionGitlabMr = {
      [SESSION_ID]: { mr: mergeRequest({ state: mrState, draft }) },
    };
    render(<StageBoardCard session={session} nav={nav} />);
    const title = `Merge request !12 · ${expected}, open in GitLab`;
    const btn = screen.getByLabelText(title);
    expect(btn.tagName).toBe('BUTTON');
  });
});

describe('StageBoardCard actions visibility', () => {
  it('keeps session details navigation only on the card body and keyboard', () => {
    render(<StageBoardCard session={session} nav={nav} />);
    const card = screen.getAllByRole('button')[0] as HTMLElement;
    expect(screen.queryByLabelText('Open session details')).toBeNull();
    fireEvent.click(card);
    fireEvent.keyDown(card, { key: 'Enter' });
    expect(nav.selectCard).toHaveBeenCalledTimes(2);
  });

  it('shows attention action tint at rest and keeps non-attention neutral', () => {
    useDynamicActionsMock.mockReturnValue([
      {
        key: 'questions',
        icon: HelpCircle,
        tone: 'warning',
        label: '1 open question',
        onClick: vi.fn(),
      },
      {
        key: 'run',
        icon: Play,
        tone: 'primary',
        label: 'run next step',
        onClick: vi.fn(),
      },
    ]);
    render(<StageBoardCard session={session} nav={nav} />);
    const attention = screen.getByLabelText('1 open question');
    const nonAttention = screen.getByLabelText('run next step');
    expect(attention.className.includes(' bg-warning/5')).toBe(true);
    expect(attention.className).toContain('text-warning');
    expect(nonAttention.className).not.toContain('bg-warning/5');
    expect(nonAttention.className.includes(' bg-primary/5')).toBe(false);
  });

  it('separates delete from archive with a divider in the lifecycle group', () => {
    render(<StageBoardCard session={session} nav={nav} />);
    const group = screen.getByRole('group', { name: 'Session lifecycle actions' });
    const archive = screen.getByLabelText('Archive').parentElement;
    const del = screen.getByLabelText('Delete').parentElement;
    const divider = group.querySelector('[role="separator"]');
    expect(divider).not.toBeNull();
    expect(Array.from(group.children)).toEqual([archive, divider, del]);
  });
});

describe('StageBoardCard review drafts', () => {
  it('shows a draft comments chip for review sessions with pending drafts', async () => {
    state.sessionPhaseRuns = {
      [SESSION_ID]: [{ id: 'agent-1', name: 'pr review', kind: 'pr-reviewer' }],
    };
    state.reviewDrafts = {
      [SESSION_ID]: [
        { id: 'draft-1', status: 'draft' },
        { id: 'draft-2', status: 'draft' },
        { id: 'draft-3', status: 'published' },
      ],
    };
    render(<StageBoardCard session={session} nav={nav} />);

    const chip = screen.getByRole('button', { name: 'Review 2 draft comments' });
    expect(chip.tagName).toBe('BUTTON');

    fireEvent.click(chip);

    expect(state.setCurrentSession).toHaveBeenCalledWith(SESSION_ID);
    await vi.waitFor(() => expect(state.setActiveLens).toHaveBeenCalledWith(SESSION_ID, 'review'));
    expect(nav.selectCard).not.toHaveBeenCalled();
  });

  it('loads drafts once for review sessions and hides the chip elsewhere', () => {
    state.sessionPhaseRuns = {
      [SESSION_ID]: [{ id: 'agent-1', name: 'pr review', kind: 'pr-reviewer' }],
    };
    render(<StageBoardCard session={session} nav={nav} />);
    expect(state.loadReviewDrafts).toHaveBeenCalledWith(SESSION_ID);
    expect(screen.queryByText(/draft comment/)).toBeNull();

    cleanup();
    state.sessionPhaseRuns = {};
    state.reviewDrafts = { [SESSION_ID]: [{ id: 'draft-1', status: 'draft' }] };
    state.loadReviewDrafts.mockClear();
    render(<StageBoardCard session={session} nav={nav} />);
    expect(state.loadReviewDrafts).not.toHaveBeenCalled();
    expect(screen.queryByText(/draft comment/)).toBeNull();
  });
});

describe('StageBoardCard footer', () => {
  it('renders compact agents, glyph-only external tasks, cost, and auto metadata in order', () => {
    hooks.stage = 'running';
    hooks.agents = [{}, {}];
    hooks.cost = 1.25;
    state.sessionExternalTasks = { [SESSION_ID]: [externalTask] };
    const autoSession = {
      ...session,
      workflowRuns: [{ autoRun: true }],
    } as unknown as Session;
    render(<StageBoardCard session={autoSession} nav={nav} />);
    const agents = screen.getByLabelText('2 agents');
    const task = screen.getByLabelText('GB-123 from Linear');
    const cost = document.querySelector('[title="Session spend: $1.25 (excludes summarizer)"]');
    const auto = screen.getByText('Autorun');
    const footer = agents.closest('[data-tooltip]')?.parentElement;
    expect(agents.querySelector('.lucide-bot')).not.toBeNull();
    expect(screen.queryByText('GB-123')).toBeNull();
    expect(cost).not.toBeNull();
    expect(auto).toBeDefined();
    expect(auto.className).toContain('text-primary');
    expect(auto.className).not.toContain('text-danger');
    expect(Array.from(footer?.children ?? []).slice(0, 4)).toEqual([
      agents.closest('[data-tooltip]'),
      task,
      cost,
      auto,
    ]);
    expect(footer?.lastElementChild?.classList.contains('lucide-chevron-right')).toBe(true);
  });

  it('singularizes the agent count label at one agent', () => {
    hooks.agents = [{}];
    render(<StageBoardCard session={session} nav={nav} />);
    expect(screen.getByLabelText('1 agent')).toBeDefined();
    expect(screen.queryByLabelText('1 agents')).toBeNull();
  });

  it('hides the agent count when there are no agents', () => {
    hooks.agents = [];
    render(<StageBoardCard session={session} nav={nav} />);
    expect(screen.queryByLabelText(/agent/)).toBeNull();
  });
});
