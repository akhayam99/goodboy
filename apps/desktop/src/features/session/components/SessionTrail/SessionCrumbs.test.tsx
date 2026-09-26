// @vitest-environment happy-dom

import type { ReactElement, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sessionPlace } from '../../../../store/slices/navigation/place';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { Agent, AgentId, Session, SessionId, SessionStageInfo } from '@goodboy/types';

const h = vi.hoisted(() => ({
  state: {} as Record<string, unknown>,
  crumbs: [
    { id: 'overview', label: 'Overview', onClick: vi.fn() },
    { id: 'lens-agents', label: 'Agents', onClick: vi.fn() },
    { id: 'selected-child', label: 'scout one' },
  ] as ReadonlyArray<{ id: string; label: string; onClick?: () => void }>,
  stage: {
    stage: 'running',
    reason: 'running',
    attention: null,
    prState: null,
  } as SessionStageInfo,
  currentSession: null as Session | null,
  navigate: vi.fn(),
  loadAgentTranscript: vi.fn(async () => undefined),
  setScriptsLensScope: vi.fn(),
  setFocusedArtifactId: vi.fn(),
  setFocusedWorkflowRun: vi.fn(),
}));

vi.mock('../../hooks/useLensDestinations', async () => {
  const { lensDestinations } = await import('../../lens-destinations');
  return {
    useLensDestinations: () =>
      lensDestinations({
        isBranchless:
          (h.state.sessionBranches as Readonly<Record<string, string>> | undefined)?.[
            'session-1'
          ] === '',
        isGithubCodeHost: false,
        connectedTools: { linear: true, gitlab: true, jira: true, slack: true },
      }),
  };
});

vi.mock('../../../../store', async () => ({
  ...(await import('../../../../store/slices/navigation/place')),
  EMPTY_ARRAY: [],
  useAppStore: Object.assign(<T,>(selector: (state: typeof h.state) => T) => selector(h.state), {
    getState: () => h.state,
  }),
  useCurrentSession: () => h.currentSession,
  useSessionStageInfo: () => h.stage,
  useSessionPlans: () => [],
  useSessionOpenQuestions: (id: SessionId) =>
    (h.state.sessionOpenQuestions as Record<string, ReadonlyArray<unknown>>)[id] ?? [],
}));

vi.mock('../../hooks/useSessionCrumbs', async () => {
  const { Circle } = await import('lucide-react');
  return {
    useSessionCrumbs: () => h.crumbs.map((crumb) => ({ icon: Circle, ...crumb })),
  };
});

vi.mock('@goodboy/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@goodboy/ui')>();
  return {
    ...actual,
    Tooltip: ({ content, children }: { content: string; children: ReactElement }) => (
      <span data-tooltip={content}>{children as ReactNode}</span>
    ),
  };
});

import { SessionCrumbs } from './SessionCrumbs';

const SESSION_ID = 'session-1' as SessionId;

const renderCrumbs = () => render(<SessionCrumbs session={h.currentSession as Session} />);

const buildAgent = (overrides: Partial<Agent> & Pick<Agent, 'id'>): Agent =>
  ({
    sessionId: SESSION_ID,
    ordinal: 0,
    name: 'scout one',
    status: 'completed',
    ...overrides,
  }) as Agent;

const scout = buildAgent({ id: 'agent-scout' as AgentId, name: 'scout one', ordinal: 0 });
const implementer = buildAgent({
  id: 'agent-impl' as AgentId,
  name: 'implement two',
  ordinal: 1,
  status: 'running',
});

const workflowStep = buildAgent({
  id: 'agent-step' as AgentId,
  name: 'workflow step',
  ordinal: 2,
  stepId: 'step-1' as never,
  workflowRunId: 'run-1' as never,
});
const laterWorkflowStep = buildAgent({
  id: 'agent-step-2' as AgentId,
  name: 'workflow review',
  ordinal: 3,
  status: 'running',
  stepId: 'step-2' as never,
  workflowRunId: 'run-1' as never,
});

const session = {
  id: SESSION_ID,
  workspaceId: 'workspace-1',
  workflowRuns: [],
} as unknown as Session;

const workflowSession = {
  ...session,
  workflowRuns: [{ id: 'run-1', workflowId: 'workflow-1', ordinal: 0 }],
} as unknown as Session;

const STEP_CRUMBS = [
  { id: 'overview', label: 'Overview', onClick: vi.fn() },
  { id: 'workflows', label: 'Workflows', onClick: vi.fn() },
  { id: 'workflow-run', label: 'refactor', onClick: vi.fn() },
  { id: 'selected-child', label: 'workflow step' },
];

const clusterAlpha = buildAgent({
  id: 'agent-cluster-alpha' as AgentId,
  name: 'area alpha',
  kind: 'implementer',
  ordinal: 4,
  status: 'running',
  parentAgentId: workflowStep.id,
  workflowRunId: 'run-1' as never,
});
const clusterBeta = buildAgent({
  id: 'agent-cluster-beta' as AgentId,
  name: 'area beta',
  kind: 'implementer',
  ordinal: 5,
  parentAgentId: workflowStep.id,
  workflowRunId: 'run-1' as never,
});

const resetState = () => {
  Object.keys(h.state).forEach((key) => delete h.state[key]);
  Object.assign(h.state, {
    selectedAgentId: { [SESSION_ID]: scout.id },
    activeLens: { [SESSION_ID]: 'agents' },
    sessionPhaseRuns: { [SESSION_ID]: [scout, implementer, workflowStep] },
    agentKindOverride: {},
    sessionResolveAttempts: {},
    sessionResolveQueueItems: {},
    sessionResolvePublications: {},
    sessionOpenQuestions: {},
    agentTurnState: {},
    sessionBranches: { [SESSION_ID]: 'ak/feat-one' },
    sessionGithub: {},
    phaseTemplates: {
      'workspace-1': [
        {
          id: 'workflow-1',
          name: 'refactor',
          steps: [
            { id: 'step-1', name: 'workflow step', ordinal: 0 },
            { id: 'step-2', name: 'workflow review', ordinal: 1 },
          ],
        },
      ],
    },
    sessionWorkflows: { [SESSION_ID]: [] },
    focusedWorkflowRunId: {},
    focusedArtifactId: {},
    sessionArtifacts: {},
    sessionProjectMounts: {},
    sessionPlans: {},
    cancelCurrentTurn: vi.fn(),
    navigate: h.navigate,
    setScriptsLensScope: h.setScriptsLensScope,
    setFocusedArtifactId: h.setFocusedArtifactId,
    setFocusedWorkflowRun: h.setFocusedWorkflowRun,
  });
};

const openClusterSurface = () => {
  h.currentSession = workflowSession;
  h.crumbs = [
    { id: 'overview', label: 'Overview', onClick: vi.fn() },
    { id: 'workflows', label: 'Workflows', onClick: vi.fn() },
    { id: 'workflow-run', label: 'refactor', onClick: vi.fn() },
    { id: 'selected-parent', label: 'workflow step', onClick: vi.fn() },
    { id: 'selected-child', label: 'area alpha' },
  ];
  h.state.selectedAgentId = { [SESSION_ID]: clusterAlpha.id };
  h.state.sessionPhaseRuns = {
    [SESSION_ID]: [scout, implementer, workflowStep, laterWorkflowStep, clusterAlpha, clusterBeta],
  };
};

const openStepSurface = () => {
  h.currentSession = workflowSession;
  h.crumbs = STEP_CRUMBS;
  h.state.selectedAgentId = { [SESSION_ID]: workflowStep.id };
  h.state.sessionPhaseRuns = {
    [SESSION_ID]: [scout, implementer, workflowStep, laterWorkflowStep],
  };
};

beforeEach(() => {
  h.currentSession = session;
  h.stage = { stage: 'running', reason: 'running', attention: null, prState: null };
  h.crumbs = [
    { id: 'overview', label: 'Overview', onClick: vi.fn() },
    { id: 'lens-agents', label: 'Agents', onClick: vi.fn() },
    { id: 'selected-child', label: scout.name },
  ];
  resetState();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('SessionCrumbs', () => {
  it('renders the ladder without a divider or bordered bar', () => {
    renderCrumbs();
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(nav.className).not.toContain('border-b');
    expect(nav.className).not.toContain('border-border-soft');
    expect(screen.queryByRole('separator', { hidden: true })).toBeNull();
  });

  it('carries the stage label and reason as a tooltip on the crumb dot', () => {
    h.stage = { ...h.stage, reason: 'PR needs review' };
    renderCrumbs();

    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    const anchor = nav.querySelector('[data-tooltip="running, PR needs review"]');
    expect(anchor).not.toBeNull();
    expect(anchor?.querySelector('.rounded-full')).not.toBeNull();
  });

  it('marks a session whose pull request was closed as abandoned, not integrated', () => {
    h.stage = { stage: 'done', reason: 'PR #12 closed', attention: null, prState: 'closed' };
    renderCrumbs();

    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    const dot = within(nav).getByRole('img', { name: 'done, PR #12 closed' });
    expect(dot.className).not.toContain('bg-merged');
    expect(dot.className).toContain('bg-muted-foreground');
  });

  it('still marks a merged session as integrated', () => {
    h.stage = { stage: 'done', reason: 'PR #12 merged', attention: null, prState: 'merged' };
    renderCrumbs();

    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(nav).getByRole('img', { name: 'done, PR #12 merged' }).className).toContain(
      'bg-merged',
    );
  });

  it('falls back to the stage explanation when the caller has no reason', () => {
    h.stage = { ...h.stage, reason: '' };
    renderCrumbs();

    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(
      nav.querySelector('[data-tooltip="running, an agent is working right now"]'),
    ).not.toBeNull();
  });

  it('lists the crumbs from useSessionCrumbs in order', () => {
    renderCrumbs();
    expect(screen.getByRole('button', { name: 'Overview' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Agents' })).toBeDefined();
    expect(screen.getByRole('button', { name: /scout one/ })).toBeDefined();
  });

  it('shows the selected agent live status after its label', () => {
    renderCrumbs();

    const selectedCrumb = screen.getByRole('button', { name: /scout one/ });
    expect(
      within(selectedCrumb).getByLabelText('Completed, it ran and finished its work'),
    ).toBeDefined();
  });

  it('gives the review crumb one number, the one the destination lists', () => {
    h.crumbs = [
      { id: 'overview', label: 'Overview', onClick: vi.fn() },
      { id: 'lens-review', label: 'Review' },
    ];
    h.state.activeLens = { [SESSION_ID]: 'review' };
    h.state.selectedAgentId = {};
    h.state.sessionResolveAttempts = {
      [SESSION_ID]: [
        { id: 'a1', phase: 'queued' },
        { id: 'a2', phase: 'queued' },
        { id: 'a3', phase: 'running' },
      ],
    };
    renderCrumbs();

    expect(screen.queryByText('2 queued')).toBeNull();
  });

  it('turns the last crumb into a sibling switcher when peers exist in the same home', () => {
    renderCrumbs();
    const last = screen.getByRole('button', { name: /scout one/ });
    expect(last.getAttribute('aria-haspopup')).toBe('menu');

    fireEvent.click(last);
    const menu = screen.getByRole('menu', { name: 'Switch agent' });
    expect(menu.textContent).toContain('implement two');
    expect(menu.textContent).not.toContain('workflow step');

    fireEvent.click(screen.getByRole('menuitemradio', { name: /implement two/ }));
    expect(h.navigate).toHaveBeenCalledWith({
      to: { at: 'agent', sessionId: SESSION_ID, agentId: implementer.id },
    });
  });

  it('keeps the menu on the last crumb even when the agent has no peer, with its own row', () => {
    h.state.sessionPhaseRuns = { [SESSION_ID]: [scout] };
    renderCrumbs();

    expect(screen.getByText('scout one').getAttribute('aria-current')).toBe('page');
    fireEvent.click(screen.getByRole('button', { name: /scout one/ }));
    const rows = within(screen.getByRole('menu', { name: 'Switch agent' })).getAllByRole(
      'menuitemradio',
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('menuitem', { name: 'Start agent' })).toBeDefined();
  });

  it('gives the lens crumb the destination switcher when no agent is selected', () => {
    h.crumbs = [
      { id: 'overview', label: 'Overview', onClick: vi.fn() },
      { id: 'lens-agents', label: 'Agents' },
    ];
    h.state.selectedAgentId = {};
    renderCrumbs();

    const last = screen.getByRole('button', { name: /Agents/ });
    expect(last.getAttribute('aria-haspopup')).toBe('menu');
    expect(screen.getByText('Agents').getAttribute('aria-current')).toBe('page');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('opens the sibling destinations from the lens crumb and marks the current one', () => {
    h.crumbs = [
      { id: 'overview', label: 'Overview', onClick: vi.fn() },
      { id: 'lens-agents', label: 'Agents' },
    ];
    h.state.selectedAgentId = {};
    renderCrumbs();

    fireEvent.click(screen.getByRole('button', { name: /Agents/ }));
    const menu = screen.getByRole('menu', { name: 'Switch page' });
    expect(menu.textContent).toContain('Artifacts');
    expect(menu.textContent).toContain('Review');
    expect(menu.textContent).toContain('Scripts');
    expect(
      within(menu)
        .getByRole('menuitemradio', { name: /Agents/ })
        .getAttribute('aria-checked'),
    ).toBe('true');

    fireEvent.click(within(menu).getByRole('menuitemradio', { name: /Review/ }));
    expect(h.navigate).toHaveBeenCalledWith({
      to: sessionPlace({ sessionId: SESSION_ID, lens: 'review' }),
    });
  });

  it('switches page from the lens crumb of a deeper trail without navigating', () => {
    const toPlans = vi.fn();
    h.crumbs = [
      { id: 'overview', label: 'Overview', onClick: vi.fn() },
      { id: 'plans', label: 'Artifacts', onClick: toPlans },
      { id: 'artifact', label: 'Rounding drift' },
    ];
    h.state.activeLens = { [SESSION_ID]: 'plans' };
    h.state.selectedAgentId = {};
    renderCrumbs();

    fireEvent.click(screen.getByRole('button', { name: 'Switch page: Artifacts' }));
    expect(toPlans).not.toHaveBeenCalled();

    const menu = screen.getByRole('menu', { name: 'Switch page' });
    fireEvent.click(within(menu).getByRole('menuitemradio', { name: /Questions/ }));
    expect(h.navigate).toHaveBeenCalledWith({
      to: sessionPlace({ sessionId: SESSION_ID, lens: 'questions' }),
    });
  });

  it('lands on the root of a destination, not on the object left open in it', () => {
    h.crumbs = [
      { id: 'overview', label: 'Overview', onClick: vi.fn() },
      { id: 'plans', label: 'Artifacts', onClick: vi.fn() },
      { id: 'artifact', label: 'Rounding drift' },
    ];
    h.state.activeLens = { [SESSION_ID]: 'plans' };
    h.state.selectedAgentId = {};
    renderCrumbs();

    fireEvent.click(screen.getByRole('button', { name: 'Switch page: Artifacts' }));
    const menu = screen.getByRole('menu', { name: 'Switch page' });
    fireEvent.click(within(menu).getByRole('menuitemradio', { name: /Artifacts/ }));

    expect(h.setFocusedArtifactId).toHaveBeenCalledWith(SESSION_ID, null);
    expect(h.setFocusedWorkflowRun).toHaveBeenCalledWith(SESSION_ID, null);
    expect(h.navigate).toHaveBeenCalledWith({
      to: sessionPlace({ sessionId: SESSION_ID, lens: 'plans' }),
    });
  });

  it('marks only the open lens, never its neighbours on the same surface', () => {
    h.crumbs = [
      { id: 'overview', label: 'Overview', onClick: vi.fn() },
      { id: 'lens-decisions', label: 'Decisions' },
    ];
    h.state.activeLens = { [SESSION_ID]: 'decisions' };
    h.state.selectedAgentId = {};
    renderCrumbs();

    fireEvent.click(screen.getByRole('button', { name: /Decisions/ }));
    const menu = screen.getByRole('menu', { name: 'Switch page' });
    const current = within(menu)
      .getAllByRole('menuitemradio')
      .filter((row) => row.getAttribute('aria-checked') === 'true');

    expect(current).toHaveLength(1);
    expect(current[0]?.textContent).toContain('Context');
  });

  it('falls back to overview when the stored lens has no home on this session', () => {
    h.crumbs = [
      { id: 'overview', label: 'Overview', onClick: vi.fn() },
      { id: 'lens-agents', label: 'Agents' },
    ];
    h.state.sessionBranches = { [SESSION_ID]: '' };
    h.state.activeLens = { [SESSION_ID]: 'review' };
    h.state.selectedAgentId = {};
    renderCrumbs();

    fireEvent.click(screen.getByRole('button', { name: /Agents/ }));
    const menu = screen.getByRole('menu', { name: 'Switch page' });
    const current = within(menu)
      .getAllByRole('menuitemradio')
      .filter((row) => row.getAttribute('aria-checked') === 'true');

    expect(menu.textContent).not.toContain('Review');
    expect(current).toHaveLength(1);
    expect(current[0]?.textContent).toContain('Overview');
  });

  it('offers overview as a destination of its own', () => {
    h.crumbs = [
      { id: 'overview', label: 'Overview', onClick: vi.fn() },
      { id: 'lens-agents', label: 'Agents' },
    ];
    h.state.selectedAgentId = {};
    renderCrumbs();

    fireEvent.click(screen.getByRole('button', { name: /Agents/ }));
    const menu = screen.getByRole('menu', { name: 'Switch page' });
    fireEvent.click(within(menu).getByRole('menuitemradio', { name: /Overview/ }));

    expect(h.navigate).toHaveBeenCalledWith({
      to: sessionPlace({ sessionId: SESSION_ID, lens: null }),
    });
  });

  it('carries the open question count on the questions destination only', () => {
    h.crumbs = [
      { id: 'overview', label: 'Overview', onClick: vi.fn() },
      { id: 'lens-agents', label: 'Agents' },
    ];
    h.state.selectedAgentId = {};
    h.state.sessionOpenQuestions = {
      [SESSION_ID]: [
        { id: 'q1', status: 'open' },
        { id: 'q2', status: 'open' },
      ],
    };
    renderCrumbs();

    fireEvent.click(screen.getByRole('button', { name: /Agents/ }));
    const menu = screen.getByRole('menu', { name: 'Switch page' });
    expect(within(menu).getByRole('menuitemradio', { name: /Questions/ }).textContent).toContain(
      '2',
    );
    expect(
      within(menu).getByRole('menuitemradio', { name: /Artifacts/ }).textContent,
    ).not.toContain('2');
  });

  it('leaves answered questions out of the destination count', () => {
    h.crumbs = [
      { id: 'overview', label: 'Overview', onClick: vi.fn() },
      { id: 'lens-agents', label: 'Agents' },
    ];
    h.state.selectedAgentId = {};
    h.state.sessionOpenQuestions = {
      [SESSION_ID]: [
        { id: 'q1', status: 'open' },
        { id: 'q2', status: 'answered' },
      ],
    };
    renderCrumbs();

    fireEvent.click(screen.getByRole('button', { name: /Agents/ }));
    const menu = screen.getByRole('menu', { name: 'Switch page' });

    expect(within(menu).getByRole('menuitemradio', { name: /Questions/ }).textContent).toContain(
      '1',
    );
    expect(
      within(menu).getByRole('menuitemradio', { name: /Questions/ }).textContent,
    ).not.toContain('2');
  });

  it('gives the lone overview crumb the destination switcher', () => {
    h.crumbs = [{ id: 'overview', label: 'Overview' }];
    h.state.activeLens = { [SESSION_ID]: null };
    h.state.selectedAgentId = {};
    renderCrumbs();

    fireEvent.click(screen.getByRole('button', { name: /Overview/ }));
    expect(screen.getByRole('menu', { name: 'Switch page' }).textContent).toContain('Terminal');
  });
});

describe('SessionCrumbs on a workflow step', () => {
  it('is the only breadcrumb on the surface, and it names all four levels', () => {
    openStepSurface();
    renderCrumbs();

    expect(screen.getAllByRole('navigation', { name: 'Breadcrumb' })).toHaveLength(1);
    expect(screen.queryByRole('navigation', { name: 'Workflow breadcrumb' })).toBeNull();
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(nav.textContent).toContain('Overview');
    expect(nav.textContent).toContain('Workflows');
    expect(nav.textContent).toContain('refactor');
    expect(nav.textContent).toContain('workflow step');
  });

  it('switches between the started steps of the open run, not across runs', () => {
    openStepSurface();
    renderCrumbs();

    fireEvent.click(screen.getByRole('button', { name: /workflow step/ }));
    const menu = screen.getByRole('menu', { name: 'Switch step' });
    expect(menu.textContent).toContain('workflow review');
    expect(menu.textContent).not.toContain('implement two');

    fireEvent.click(screen.getByRole('menuitemradio', { name: /workflow review/ }));
    expect(h.navigate).toHaveBeenCalledWith({
      to: { at: 'agent', sessionId: SESSION_ID, agentId: laterWorkflowStep.id },
    });
  });
});

describe('SessionCrumbs on a cluster child', () => {
  it('names the father level between the run and the child', () => {
    openClusterSurface();
    renderCrumbs();

    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(nav.textContent).toContain('Overview');
    expect(nav.textContent).toContain('Workflows');
    expect(nav.textContent).toContain('refactor');
    expect(nav.textContent).toContain('workflow step');
    expect(nav.textContent).toContain('area alpha');
  });

  it('navigates to the father when its label is clicked', () => {
    openClusterSurface();
    renderCrumbs();

    fireEvent.click(screen.getByRole('button', { name: 'workflow step' }));
    const parentCrumb = h.crumbs.find((crumb) => crumb.id === 'selected-parent');
    expect(parentCrumb?.onClick).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('keeps the step switcher on the father crumb, scoped to the run steps', () => {
    openClusterSurface();
    renderCrumbs();

    fireEvent.click(screen.getByRole('button', { name: 'Switch step: workflow step' }));
    const menu = screen.getByRole('menu', { name: 'Switch step' });
    expect(menu.textContent).toContain('workflow review');
    expect(menu.textContent).not.toContain('area beta');
    expect(menu.textContent).not.toContain('implement two');

    fireEvent.click(screen.getByRole('menuitemradio', { name: /workflow review/ }));
    expect(h.navigate).toHaveBeenCalledWith({
      to: { at: 'agent', sessionId: SESSION_ID, agentId: laterWorkflowStep.id },
    });
  });

  it('scopes the child dropdown to the cluster siblings only', () => {
    openClusterSurface();
    renderCrumbs();

    fireEvent.click(screen.getByRole('button', { name: /area alpha/ }));
    const menu = screen.getByRole('menu', { name: 'Switch agent' });
    expect(menu.textContent).toContain('area beta');
    expect(menu.textContent).not.toContain('workflow step');
    expect(menu.textContent).not.toContain('workflow review');
    expect(menu.textContent).not.toContain('implement two');

    fireEvent.click(screen.getByRole('menuitemradio', { name: /area beta/ }));
    expect(h.navigate).toHaveBeenCalledWith({
      to: { at: 'agent', sessionId: SESSION_ID, agentId: clusterBeta.id },
    });
  });

  it('truncates every agent crumb by the room left, never by a fixed cap', () => {
    openClusterSurface();
    h.crumbs = [
      { id: 'overview', label: 'Overview', onClick: vi.fn() },
      { id: 'workflows', label: 'Workflows', onClick: vi.fn() },
      { id: 'workflow-run', label: 'a very long workflow kind name', onClick: vi.fn() },
      {
        id: 'selected-parent',
        label: 'an extremely long father agent display name',
        onClick: vi.fn(),
      },
      { id: 'selected-child', label: 'an even longer cluster child area description name' },
    ];
    renderCrumbs();

    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(nav.className).not.toContain('flex-wrap');
    const father = screen.getByRole('button', {
      name: 'an extremely long father agent display name',
    });
    expect(father.className).toContain('truncate');
    expect(father.className).not.toContain('max-w-64');
    const child = screen.getByRole('button', {
      name: /an even longer cluster child area description name/,
    });
    expect(child.className).toContain('truncate');
  });
});

type OpenAtParams = {
  readonly top: number;
};

const openMenuAt = ({ top }: OpenAtParams): HTMLElement => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 768 });
  renderCrumbs();
  const trigger = screen.getByRole('button', { name: /scout one/ });
  const container = trigger.closest('div.relative') as HTMLElement;
  container.getBoundingClientRect = () =>
    DOMRect.fromRect({ x: 16, y: top, width: 120, height: 20 });

  fireEvent.click(trigger);
  return screen.getByRole('menu', { name: 'Switch agent' });
};

describe('SessionCrumbs switcher popover', () => {
  it('gives the scrolling viewport the whole popover, so nothing is cut early', () => {
    h.state.sessionPhaseRuns = {
      [SESSION_ID]: Array.from({ length: 20 }, (_, index) =>
        buildAgent({ id: `agent-${index}` as AgentId, name: `agent ${index}`, ordinal: index }),
      ),
    };
    h.state.selectedAgentId = { [SESSION_ID]: 'agent-0' };
    h.crumbs = [
      { id: 'overview', label: 'Overview', onClick: vi.fn() },
      { id: 'lens-agents', label: 'Agents', onClick: vi.fn() },
      { id: 'selected-child', label: 'agent 0' },
    ];
    renderCrumbs();

    fireEvent.click(screen.getByRole('button', { name: /agent 0/ }));
    const menu = screen.getByRole('menu', { name: 'Switch agent' });

    expect(menu.style.maxHeight).not.toBe('');
    const viewport = menu.querySelector('[data-crumb-list]');
    expect(viewport?.className).toContain('overflow-y-auto');
    expect(viewport?.className).toContain('flex-1');
    expect(viewport?.className).not.toContain('max-h');
  });

  it('caps a downward menu at the room below the trigger', () => {
    const menu = openMenuAt({ top: 40 });

    expect(menu.className).toContain('fixed');
    expect(menu.style.top).toBe('64px');
    expect(menu.style.maxHeight).toBe('696px');
  });

  it('flips up near the window floor and caps at the room above', () => {
    const menu = openMenuAt({ top: 700 });

    expect(menu.style.top).toBe('');
    expect(menu.style.bottom).toBe('72px');
    expect(menu.style.maxHeight).toBe('688px');
  });

  it('escapes the crumb row so the trigger height never caps the menu', () => {
    renderCrumbs();

    fireEvent.click(screen.getByRole('button', { name: /scout one/ }));
    const menu = screen.getByRole('menu', { name: 'Switch agent' });

    expect(menu.closest('nav')).toBeNull();
    expect(menu.closest('[data-dropdown-portal]')).not.toBeNull();
  });
});
