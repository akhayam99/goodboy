import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type {
  PullRequestState,
  Session,
  SessionExternalTask,
  SessionId,
  SessionStage,
} from '@goodboy/types';
import type { GitlabMergeRequest } from '../../../../integrations/gitlab/client';
import type { BoardNavigation } from '../useBoardNavigation';

const { state, hooks } = vi.hoisted(() => ({
  state: {
    sessionGithub: {} as Record<string, { pr: PullRequestState | null }>,
    sessionGitlabMr: {} as Record<string, { mr: GitlabMergeRequest | null }>,
    sessionExternalTasks: {} as Record<string, ReadonlyArray<SessionExternalTask>>,
    sessionWorktrees: {} as Record<string, ReadonlyArray<string>>,
    sessionPhaseRuns: {} as Record<string, ReadonlyArray<unknown>>,
    reviewDrafts: {} as Record<string, ReadonlyArray<unknown>>,
    loadReviewDrafts: vi.fn(async () => undefined),
  },
  hooks: {
    stage: 'building' as SessionStage,
    reason: 'no PR yet',
    agents: [] as ReadonlyArray<unknown>,
    cost: 0,
  },
}));

vi.mock('../../../../../store', () => ({
  EMPTY_ARRAY: [] as readonly never[],
  useAppStore: <T,>(selector: (store: typeof state) => T) => selector(state),
  useNonResolverStandaloneAgents: () => hooks.agents,
  useSessionCost: () => hooks.cost,
  useSessionStageInfo: () => ({ stage: hooks.stage, reason: hooks.reason }),
}));

vi.mock('./useDynamicActions', () => ({
  useDynamicActions: () => [],
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
  state.sessionPhaseRuns = {};
  state.reviewDrafts = {};
  state.loadReviewDrafts.mockClear();
  nav.selectCard.mockClear();
  hooks.reason = 'no PR yet';
  hooks.agents = [];
  hooks.cost = 0;
});

afterEach(cleanup);

describe('StageBoardCard layout', () => {
  it('uses fixed card and title slots while always rendering the footer row', () => {
    render(<StageBoardCard session={session} nav={nav} />);
    const card = screen.getAllByRole('button')[0];
    const title = screen.getByText(session.goal);
    const footer = title.closest('[data-tooltip]')?.parentElement?.nextElementSibling;
    expect(card?.className).toContain('h-[7.25rem]');
    expect(title.className).toContain('line-clamp-2');
    expect(title.className).toContain('min-h-10');
    expect(footer?.className).toContain('flex-nowrap');
    expect(footer?.className).toContain('min-h-5');
  });

  it('keeps the reason in the title tooltip without rendering a status dot or reason line', () => {
    render(<StageBoardCard session={session} nav={nav} />);
    const tooltip = screen.getByText(session.goal).closest('[data-tooltip]');
    expect(tooltip?.getAttribute('data-tooltip')).toBe(`${session.goal} · no PR yet`);
    expect(screen.queryByTestId('status-dot')).toBeNull();
    expect(screen.queryByText('no PR yet')).toBeNull();
  });
});

describe('StageBoardCard selection', () => {
  it('renders no selection checkbox when the column does not offer selection', () => {
    render(<StageBoardCard session={session} nav={nav} />);
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('toggles selection from the checkbox without opening the session', () => {
    const onToggleSelect = vi.fn();
    render(
      <StageBoardCard
        session={session}
        nav={nav}
        onToggleSelect={onToggleSelect}
        selected={false}
      />,
    );
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onToggleSelect).toHaveBeenCalledWith(SESSION_ID, expect.anything());
    expect(nav.selectCard).not.toHaveBeenCalled();
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
    window.addEventListener('goodboy:open-gitlab-studio', (e) => dispatched.push(e));
    render(<StageBoardCard session={session} nav={nav} />);
    const btn = screen.getByLabelText('Merge request !12 · open, open in GitLab');
    fireEvent.click(btn);
    expect(dispatched).toHaveLength(1);
    window.removeEventListener('goodboy:open-gitlab-studio', (e) => dispatched.push(e));
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
  it('renders static actions without opacity-0 class', () => {
    render(<StageBoardCard session={session} nav={nav} />);
    const archiveBtn = screen.getByLabelText('archive');
    const actionsContainer = archiveBtn.closest('span.mt-auto');
    expect(actionsContainer?.className).not.toContain('opacity-0');
  });

  it('renders action buttons with hover color classes', () => {
    render(<StageBoardCard session={session} nav={nav} />);
    const deleteBtn = screen.getByLabelText('delete');
    expect(deleteBtn.className).toContain('hover:text-danger');
  });
});

describe('StageBoardCard review drafts', () => {
  it('shows a draft comments chip for review sessions with pending drafts', () => {
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

    expect(screen.getByText('draft comments').previousElementSibling?.textContent).toBe('2');
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
    const cost = document.querySelector('[title="session spend: $1.25 (excludes summarizer)"]');
    const auto = screen.getByText('auto');
    const footer = agents.closest('[data-tooltip]')?.parentElement;
    expect(agents.querySelector('.lucide-bot')).not.toBeNull();
    expect(screen.queryByText('GB-123')).toBeNull();
    expect(cost).not.toBeNull();
    expect(auto).toBeDefined();
    expect(Array.from(footer?.children ?? [])).toEqual([
      agents.closest('[data-tooltip]'),
      task,
      cost,
      auto,
    ]);
  });
});
