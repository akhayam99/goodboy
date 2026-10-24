import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { HelpCircle, Play, type LucideIcon } from 'lucide-react';
import type {
  IsoDateTime,
  PullRequestState,
  SessionAttentionReason,
  SessionExternalTask,
  SessionId,
  SessionPrFetchState,
  SessionStage,
  WorkspaceId,
} from '@goodboy/types';
import { aSession, aWorkflowRun } from '@goodboy/types/testing';
import type { GitlabMergeRequest } from '../../../../integrations/gitlab/client';
import type { BoardNavigation } from '../useBoardNavigation';

type MockDynamicAction = {
  readonly key: string;
  readonly icon: LucideIcon;
  readonly tone: 'primary' | 'warning' | 'danger';
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
    sessionPins: {} as Record<string, ReadonlyArray<{ id: string; at: number }>>,
    projects: [] as ReadonlyArray<unknown>,
    sessionPhaseRuns: {} as Record<string, ReadonlyArray<unknown>>,
    agentTurnState: {} as Record<string, unknown>,
    reviewDrafts: {} as Record<string, ReadonlyArray<unknown>>,
    sessionOpenQuestions: {} as Record<string, ReadonlyArray<{ status: string }>>,
    phaseTemplates: {} as Record<string, ReadonlyArray<unknown>>,
    sessionWorkflows: {} as Record<string, ReadonlyArray<unknown>>,
    loadReviewDrafts: vi.fn(async () => undefined),
    navigate: vi.fn(),
  },
  hooks: {
    stage: 'building' as SessionStage,
    reason: 'no PR yet',
    addsFact: true,
    attention: null as SessionAttentionReason | null,
    openQuestionCount: 0,
    isRunning: false,
    agents: [] as ReadonlyArray<unknown>,
    cost: 0,
    prFetchState: 'known' as SessionPrFetchState,
  },
  useDynamicActionsMock: vi.fn((): ReadonlyArray<MockDynamicAction> => []),
}));

vi.mock('../../../../../store', async () => ({
  ...(await import('../../../../../store/slices/navigation/place')),
  EMPTY_ARRAY: [] as readonly never[],
  useAppStore: Object.assign(<T,>(selector: (store: typeof state) => T) => selector(state), {
    getState: () => state,
  }),
  useNonResolverStandaloneAgents: () => hooks.agents,
  useSessionCost: () => hooks.cost,
  useSessionPrFetchState: () => hooks.prFetchState,
  useSessionStageInfo: () => ({
    stage: hooks.stage,
    reason: hooks.reason,
    addsFact: hooks.addsFact,
    attention: hooks.attention,
    prState: null,
    isRunning: hooks.isRunning,
    openQuestionCount: hooks.openQuestionCount,
  }),
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
  openUnreadReply: vi.fn(),
  openIDE: vi.fn(),
  openQuestions: vi.fn(),
  openWorkflows: vi.fn(),
  openPullRequest: vi.fn(),
  openReview: vi.fn(),
} satisfies BoardNavigation;

const WORKSPACE_ID = 'workspace-1' as WorkspaceId;
const session = aSession({
  id: SESSION_ID,
  workspaceId: WORKSPACE_ID,
  goal: 'Keep every board card compact',
});

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
  state.sessionPins = {};
  state.projects = [];
  state.sessionPhaseRuns = {};
  state.agentTurnState = {};
  state.reviewDrafts = {};
  state.sessionOpenQuestions = {};
  state.phaseTemplates = {};
  state.sessionWorkflows = {};
  state.loadReviewDrafts.mockClear();
  state.navigate.mockClear();
  useDynamicActionsMock.mockReset();
  useDynamicActionsMock.mockReturnValue([]);
  nav.selectCard.mockClear();
  nav.openPullRequest.mockClear();
  hooks.stage = 'building';
  hooks.reason = 'no PR yet';
  hooks.addsFact = true;
  hooks.attention = null;
  hooks.openQuestionCount = 0;
  hooks.isRunning = false;
  hooks.agents = [];
  hooks.cost = 0;
  hooks.prFetchState = 'known';
});

afterEach(cleanup);

const cardTitle = () => screen.getByRole('button', { name: session.goal });

const signalSlot = () => screen.getByRole('article').querySelector('[data-slot="card-signal"]');

describe('StageBoardCard layout', () => {
  it('keeps a fixed 96px height with a two-line title and one bottom line', () => {
    render(<StageBoardCard session={session} nav={nav} />);
    const card = screen.getByRole('article');
    const title = screen.getByText(session.goal);
    expect(card.className).toContain('h-24');
    expect(card.className).not.toContain('h-28');
    expect(title.className).toContain('line-clamp-2');
    expect(title.className).toContain('text-row');
    expect(cardTitle().getAttribute('title')).toBeNull();
    expect(cardTitle().closest('[data-tooltip]')?.getAttribute('data-tooltip')).toBe(session.goal);
    expect(card.querySelector('[data-slot="card-project"]')?.className).toContain('row-start-2');
    expect(signalSlot()?.className).toContain('row-start-2');
  });

  it('says nothing under the title: no reason line, no progress, no chevron', () => {
    render(<StageBoardCard session={session} nav={nav} />);
    expect(screen.queryByText('no PR yet')).toBeNull();
    expect(screen.queryByTestId('session-progress')).toBeNull();
    expect(document.querySelector('.lucide-chevron-right')).toBeNull();
  });

  it('renders a backticked goal as inline code and keeps the tooltip plain', () => {
    const marked = aSession({ ...session, goal: 'run `/explore` first' });
    render(<StageBoardCard session={marked} nav={nav} />);
    const title = screen.getByText(/run/);
    expect(title.querySelector('code')?.textContent).toBe('/explore');
    expect(title.textContent).not.toContain('`');
    expect(title.closest('[data-tooltip]')?.getAttribute('data-tooltip')).toBe(
      'run /explore first',
    );
  });

  it('names the project in gray at the left, with a count when there are several', () => {
    state.sessionProjectMounts = {
      [SESSION_ID]: [{ projectId: 'project-1', mountName: 'payments-api' }],
    };
    render(<StageBoardCard session={session} nav={nav} />);
    const project = screen.getByText('payments-api');
    expect(project.className).toContain('text-muted-foreground');
    expect(project.className).toContain('truncate');

    cleanup();
    state.sessionProjectMounts = {
      [SESSION_ID]: [
        { projectId: 'project-1', mountName: 'payments-api' },
        { projectId: 'project-2', mountName: 'ledger-core' },
      ],
    };
    render(<StageBoardCard session={session} nav={nav} />);
    expect(screen.getByText('payments-api +1')).toBeDefined();
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
    fireEvent.click(cardTitle(), { altKey: true });
    expect(onModifierClick).toHaveBeenCalledWith(SESSION_ID, expect.anything());
    expect(nav.selectCard).not.toHaveBeenCalled();
  });

  it('selects from the keyboard with alt and Enter', () => {
    const onModifierClick = vi.fn();
    render(<StageBoardCard session={session} nav={nav} onModifierClick={onModifierClick} />);
    const card = cardTitle();
    expect(card.getAttribute('aria-keyshortcuts')).toBe('Alt+Enter Shift+Enter Shift+F10');
    fireEvent.keyDown(card, { key: 'Enter', altKey: true });
    expect(onModifierClick).toHaveBeenCalledWith(SESSION_ID, expect.anything());
    expect(nav.selectCard).not.toHaveBeenCalled();
  });

  it('opens the session on a plain Enter', () => {
    render(<StageBoardCard session={session} nav={nav} onModifierClick={vi.fn()} />);
    fireEvent.keyDown(cardTitle(), { key: 'Enter' });
    expect(nav.selectCard).toHaveBeenCalledWith(session);
  });

  it('exposes the id the lasso hit-tests against', () => {
    render(<StageBoardCard session={session} nav={nav} />);
    expect(screen.getByRole('article').getAttribute('data-select-id')).toBe(SESSION_ID);
  });

  it('keeps the title as the only card button and its actions as siblings', () => {
    render(<StageBoardCard session={session} nav={nav} />);
    const card = screen.getByRole('article');
    const buttons = within(card).getAllByRole('button');
    expect(buttons.filter((button) => button.contains(cardTitle()))).toEqual([cardTitle()]);
    expect(buttons.every((button) => button === cardTitle() || !cardTitle().contains(button))).toBe(
      true,
    );
    expect(card.getAttribute('role')).toBeNull();
  });

  it('routes a modifier click on the card to selection instead of navigation', () => {
    const onModifierClick = vi.fn();
    render(<StageBoardCard session={session} nav={nav} onModifierClick={onModifierClick} />);
    fireEvent.click(cardTitle(), { metaKey: true });
    expect(onModifierClick).toHaveBeenCalledWith(SESSION_ID, expect.anything());
    expect(nav.selectCard).not.toHaveBeenCalled();
  });

  it('navigates on a plain click even when selection is available', () => {
    render(<StageBoardCard session={session} nav={nav} onModifierClick={vi.fn()} />);
    fireEvent.click(cardTitle());
    expect(nav.selectCard).toHaveBeenCalledWith(session);
  });
});

describe('StageBoardCard one signal', () => {
  it('shows nothing at the right when nothing asks for attention', () => {
    render(<StageBoardCard session={session} nav={nav} />);
    expect(signalSlot()?.children.length).toBe(0);
  });

  it('puts an open question first, above a failed check, a pull request and running work', () => {
    hooks.openQuestionCount = 2;
    hooks.attention = 'ci-failed';
    hooks.isRunning = true;
    state.sessionGithub = { [SESSION_ID]: { pr: pullRequest } };
    render(<StageBoardCard session={session} nav={nav} />);
    expect(screen.getByRole('img', { name: '2 open questions' })).toBeDefined();
    expect(signalSlot()?.querySelectorAll('[data-board-signal]')).toHaveLength(1);
  });

  it('puts a failed check above the pull request token', () => {
    hooks.attention = 'ci-failed';
    state.sessionGithub = { [SESSION_ID]: { pr: pullRequest } };
    render(<StageBoardCard session={session} nav={nav} />);
    expect(screen.getByRole('img', { name: 'Checks failing' })).toBeDefined();
    expect(screen.queryByRole('button', { name: /Open pull request/ })).toBeNull();
  });

  it('opens the pull request from its token, keeping its state color, never the session', () => {
    state.sessionGithub = { [SESSION_ID]: { pr: pullRequest } };
    render(<StageBoardCard session={session} nav={nav} />);
    const token = screen.getByRole('button', { name: 'Open pull request 9484' });
    expect(token.textContent).toContain('#9484');
    fireEvent.click(token);
    expect(nav.openPullRequest).toHaveBeenCalledWith(session);
    expect(nav.selectCard).not.toHaveBeenCalled();
  });

  it('opens the Branch page from a GitLab merge request token', () => {
    state.sessionGitlabMr = { [SESSION_ID]: { mr: mergeRequest({ state: 'opened' }) } };
    render(<StageBoardCard session={session} nav={nav} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open pull request 12' }));
    expect(nav.openPullRequest).toHaveBeenCalledWith(session);
  });

  it.each([
    ['opened', false, 'Open'],
    ['opened', true, 'Draft'],
    ['merged', false, 'Merged'],
    ['closed', false, 'Closed'],
  ])('maps GitLab %s with draft %s to the %s word', (mrState, draft, word) => {
    state.sessionGitlabMr = { [SESSION_ID]: { mr: mergeRequest({ state: mrState, draft }) } };
    render(<StageBoardCard session={session} nav={nav} />);
    expect(
      signalSlot()?.querySelector('[data-tooltip]')?.getAttribute('data-tooltip')?.toLowerCase(),
    ).toContain(word.toLowerCase());
  });

  it('shows the running dot with its count when nothing else speaks', () => {
    hooks.isRunning = true;
    state.sessionPhaseRuns = {
      [SESSION_ID]: [
        { id: 'a-1', status: 'running' },
        { id: 'a-2', status: 'running' },
        { id: 'a-3', status: 'completed' },
      ],
    };
    render(<StageBoardCard session={session} nav={nav} />);
    expect(screen.getByRole('img', { name: '2 agents running' })).toBeDefined();
  });

  it('leaves the slot empty while GitHub has not answered, no skeleton per card', () => {
    hooks.prFetchState = 'unknown';
    render(<StageBoardCard session={session} nav={nav} />);
    expect(signalSlot()?.children.length).toBe(0);
  });

  it('marks the slot offline when GitHub could not be reached', () => {
    hooks.prFetchState = 'unreachable';
    render(<StageBoardCard session={session} nav={nav} />);
    expect(screen.getByLabelText('Could not reach GitHub, will retry')).toBeTruthy();
  });

  it('keeps an archived card to its pull request, never a live signal', () => {
    hooks.openQuestionCount = 1;
    hooks.isRunning = true;
    render(<StageBoardCard session={session} nav={nav} archived />);
    expect(signalSlot()?.children.length).toBe(0);
  });
});

describe('StageBoardCard actions', () => {
  it('keeps session details navigation only on the card body and keyboard', () => {
    render(<StageBoardCard session={session} nav={nav} />);
    const card = cardTitle();
    expect(screen.queryByLabelText('Open session details')).toBeNull();
    fireEvent.click(card);
    fireEvent.keyDown(card, { key: 'Enter' });
    expect(nav.selectCard).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['warning', '1 open question'],
    ['danger', 'Confirm skip and continue'],
  ] as const)(
    'keeps a %s quick action quiet at rest, so the stage track is the one tone',
    (tone, label) => {
      useDynamicActionsMock.mockReturnValue([
        { key: 'attention', icon: HelpCircle, tone, label, onClick: vi.fn() },
        { key: 'run', icon: Play, tone: 'primary', label: 'run next step', onClick: vi.fn() },
      ]);
      render(<StageBoardCard session={session} nav={nav} />);

      expect(screen.getByLabelText(label).hasAttribute('data-highlighted')).toBe(false);
      expect(screen.getAllByTestId('tone-bar')).toHaveLength(1);
      expect(screen.queryByLabelText('run next step')).toBeNull();
    },
  );

  it.each([
    ['building', 'neutral'],
    ['running', 'info'],
    ['attention', 'warning'],
    ['review', 'success'],
    ['done', 'merged'],
  ] as const)('draws the %s stage as a %s track at the card edge', (stage, tone) => {
    hooks.stage = stage;
    render(<StageBoardCard session={session} nav={nav} />);
    const track = screen.getByTestId('tone-bar');
    expect(track.getAttribute('data-tone')).toBe(tone);
    expect(track.className.includes('animate-soft-pulse')).toBe(stage === 'running');
  });

  it('keeps an archived card on a neutral, still track', () => {
    hooks.stage = 'running';
    render(<StageBoardCard session={session} nav={nav} archived />);
    const track = screen.getByTestId('tone-bar');
    expect(track.getAttribute('data-tone')).toBe('neutral');
    expect(track.className.includes('animate-soft-pulse')).toBe(false);
  });

  it('draws no menu glyph on the card: the lifecycle menu is its right click', () => {
    render(<StageBoardCard session={session} nav={nav} />);
    expect(screen.queryByRole('button', { name: 'Session actions' })).toBeNull();
    expect(screen.getByRole('article').querySelector('.opacity-0')).toBeNull();
  });

  it('shows restore as the one visible action on an archived card', () => {
    render(<StageBoardCard session={session} nav={nav} archived />);
    const restore = screen.getByLabelText('Restore');
    expect(restore.className).not.toContain('opacity-0');
    const group = screen.getByRole('group', { name: 'Session quick actions' });
    expect(group.contains(restore)).toBe(true);
  });

  it('hands its own element to the hover card on enter and lets go on leave', () => {
    const onHoverEnter = vi.fn();
    const onHoverLeave = vi.fn();
    render(
      <StageBoardCard
        session={session}
        nav={nav}
        onHoverEnter={onHoverEnter}
        onHoverLeave={onHoverLeave}
      />,
    );
    const card = screen.getByRole('article');
    fireEvent.mouseEnter(card);
    expect(onHoverEnter).toHaveBeenCalledWith({ sessionId: SESSION_ID, anchor: card });
    fireEvent.mouseLeave(card);
    expect(onHoverLeave).toHaveBeenCalled();
  });
});

describe('StageBoardCard facts moved to the hover card', () => {
  it('carries no age, cost, agent count, issue chips, Auto chip, pin or draft chip', () => {
    hooks.agents = [{}, {}];
    hooks.cost = 1.25;
    state.sessionExternalTasks = { [SESSION_ID]: [externalTask] };
    state.sessionPins = { [WORKSPACE_ID]: [{ id: SESSION_ID, at: 1 }] };
    state.sessionPhaseRuns = {
      [SESSION_ID]: [{ id: 'agent-1', name: 'pr review', kind: 'pr-reviewer' }],
    };
    state.reviewDrafts = { [SESSION_ID]: [{ id: 'draft-1', status: 'draft' }] };
    const updated = aSession({
      ...session,
      updatedAt: new Date(Date.now() - 7_200_000).toISOString() as IsoDateTime,
      workflowRuns: [aWorkflowRun({ autoRun: true })],
    });
    render(<StageBoardCard session={updated} nav={nav} />);
    expect(screen.queryByText('2h ago')).toBeNull();
    expect(screen.queryByText('$1.25')).toBeNull();
    expect(screen.queryByLabelText('2 agents')).toBeNull();
    expect(screen.queryByLabelText('GB-123 from Linear')).toBeNull();
    expect(screen.queryByLabelText('Autopilot')).toBeNull();
    expect(screen.queryByRole('img', { name: 'Pinned' })).toBeNull();
    expect(screen.queryByText(/draft comment/)).toBeNull();
  });
});
