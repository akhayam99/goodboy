// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn().mockResolvedValue(vi.fn()) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));
vi.mock('@tauri-apps/plugin-shell', () => ({ Command: { create: vi.fn() } }));
vi.mock('@tauri-apps/plugin-sql', () => ({
  default: { load: vi.fn().mockResolvedValue({}) },
}));

vi.mock('../store', () => ({
  EMPTY_ARRAY: [],
  useSessionOpenQuestions: vi.fn().mockReturnValue([]),
  useAppStore: vi.fn((selector: (s: unknown) => unknown) => {
    const state = {
      upsertSessionSlot: vi.fn(),
      toggleSessionSlot: vi.fn(),
      loadSessionOpenQuestions: vi.fn().mockResolvedValue(undefined),
      loadSessionPlans: vi.fn().mockResolvedValue(undefined),
      reconcileSessionBranch: vi.fn().mockResolvedValue(undefined),
      loadSlotHistory: vi.fn().mockResolvedValue(undefined),
      retrySummarizer: vi.fn(),
      summarizerStatus: {},
      sessionTelemetry: {},
      sessionWorktrees: { 'sess-1': ['/work/sess-1'] },
      settings: {},
      githubStatus: null,
      sessionBranches: {},
      sessionGithub: {},
      sessionPendingResolutions: {},
      loadPendingResolutions: vi.fn().mockResolvedValue(undefined),
      pushAllResolutions: vi.fn().mockResolvedValue({ pushed: false, resolved: 0, failed: 0 }),
      sessions: [],
      workspaces: [],
      phaseTemplates: {},
      selectedAgentId: {},
      selectAgent: vi.fn().mockResolvedValue(undefined),
      requestOpenQuestionScroll: vi.fn(),
      refreshSessionPr: vi.fn(),
      refreshSessionPrDetail: vi.fn(),
      createPrForSession: vi.fn(),
      spawnAgent: vi.fn(),
      clearSessionNextActions: vi.fn(),
      loadDiffComments: vi.fn().mockResolvedValue(undefined),
      scriptRuns: {},
      terminalSessions: {},
      openTerminal: vi.fn().mockResolvedValue(undefined),
      closeTerminal: vi.fn().mockResolvedValue(undefined),
      terminalTabs: {},
      activeTerminalTab: {},
      addTerminalTab: vi.fn(() => 'sess-1::t1'),
      closeTerminalTab: vi.fn(),
      setActiveTerminalTab: vi.fn(),
      setTerminalTabStatus: vi.fn(),
      sessionPlans: {},
      sessionPhaseRuns: {},
      setPlanStatus: vi.fn(),
      updatePlanBody: vi.fn(),
      deletePlan: vi.fn(),
    };
    return selector(state);
  }),
  useSessionSlots: vi.fn().mockReturnValue([]),
  useSummarizerStatus: vi.fn().mockReturnValue({
    status: 'idle',
    lastUpdate: null,
    error: null,
    lastUsage: null,
    lastAttempt: null,
  }),
  useSlotHistory: vi.fn().mockReturnValue([]),
  useDiffComments: vi.fn().mockReturnValue([]),
  useFilesTouched: vi.fn().mockReturnValue({ paths: [], count: 0 }),
  useSessionPlans: vi.fn().mockReturnValue([]),
  useSessionLoading: vi.fn().mockReturnValue({
    agents: false,
    transcript: false,
    telemetry: false,
    slots: false,
    plans: false,
    summary: false,
  }),
}));

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Session, SessionId, WorkspaceId } from '@goodboy/types';
import { ContextPanel } from '../features/context/components/ContextPanel';

afterEach(cleanup);

const WS_ID = 'ws-test' as WorkspaceId;

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'sess-1' as SessionId,
    workspaceId: WS_ID,
    goal: 'test goal',
    branchPrefix: 'test',
    createdAt: '2026-01-01T00:00:00.000Z' as never,
    state: { kind: 'idle' },
    providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
    ...overrides,
  } as Session;
}

describe('snapshot, ContextPanel variants', () => {
  it('collapsed: renders rail button, not slot content', () => {
    const { container } = render(
      <ContextPanel session={makeSession()} collapsed={true} onExpand={vi.fn()} />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it('expanded: renders slot content, not rail button', () => {
    const { container } = render(
      <ContextPanel session={makeSession()} collapsed={false} onCollapse={vi.fn()} />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});

describe('ContextPanel rail, a11y attributes', () => {
  it('has role=button', () => {
    render(<ContextPanel session={makeSession()} collapsed={true} onExpand={vi.fn()} />);
    expect(screen.getByRole('button', { name: /expand context panel/i })).toBeDefined();
  });

  it('has aria-label="expand context panel"', () => {
    render(<ContextPanel session={makeSession()} collapsed={true} onExpand={vi.fn()} />);
    const rail = screen.getByRole('button', { name: /expand context panel/i });
    expect(rail.getAttribute('aria-label')).toBe('expand context panel');
  });

  it('is focusable (native button)', () => {
    render(<ContextPanel session={makeSession()} collapsed={true} onExpand={vi.fn()} />);
    const rail = screen.getByRole('button', { name: /expand context panel/i });
    rail.focus();
    expect(document.activeElement).toBe(rail);
  });
});

describe('ContextPanel rail, keyboard', () => {
  it('Enter key calls onExpand', async () => {
    const onExpand = vi.fn();
    render(<ContextPanel session={makeSession()} collapsed={true} onExpand={onExpand} />);
    const rail = screen.getByRole('button', { name: /expand context panel/i });
    rail.focus();
    fireEvent.keyDown(rail, { key: 'Enter' });
    expect(onExpand).toHaveBeenCalledOnce();
  });

  it('Space key calls onExpand', async () => {
    const onExpand = vi.fn();
    render(<ContextPanel session={makeSession()} collapsed={true} onExpand={onExpand} />);
    const rail = screen.getByRole('button', { name: /expand context panel/i });
    rail.focus();
    fireEvent.keyDown(rail, { key: ' ' });
    expect(onExpand).toHaveBeenCalledOnce();
  });

  it('click calls onExpand', async () => {
    const user = userEvent.setup();
    const onExpand = vi.fn();
    render(<ContextPanel session={makeSession()} collapsed={true} onExpand={onExpand} />);
    const rail = screen.getByRole('button', { name: /expand context panel/i });
    await user.click(rail);
    expect(onExpand).toHaveBeenCalledOnce();
  });
});

describe('ContextPanel, persistence contract', () => {
  it('collapsed=false: rail button present in DOM but visually hidden', () => {
    render(<ContextPanel session={makeSession()} collapsed={false} onCollapse={vi.fn()} />);
    const rail = screen.getByRole('button', { name: /expand context panel/i });
    expect(rail.closest('.hidden')).not.toBeNull();
  });

  it('collapsed=true: context header present in DOM but visually hidden', () => {
    render(<ContextPanel session={makeSession()} collapsed={true} onExpand={vi.fn()} />);
    const scrollArea = document.querySelector('.h-full.hidden');
    expect(scrollArea).not.toBeNull();
  });
});

describe('ContextPanel, 2-tab rail', () => {
  it('shows only Context and Terminal tabs', () => {
    render(<ContextPanel session={makeSession()} collapsed={false} onCollapse={vi.fn()} />);
    const tabs = screen.getAllByRole('tab');
    const labels = tabs.map((t) => t.getAttribute('aria-label'));
    expect(labels).toContain('Context');
    expect(labels).toContain('Terminal');
    expect(labels).not.toContain('Plans');
    expect(labels).not.toContain('Questions');
  });

  it('plans launcher row exists and dispatches goodboy:open-plan-studio', () => {
    render(<ContextPanel session={makeSession()} collapsed={false} onCollapse={vi.fn()} />);
    const dispatchedEvents: CustomEvent[] = [];
    window.addEventListener('goodboy:open-plan-studio', (e) => {
      dispatchedEvents.push(e as CustomEvent);
    });
    const planBtn = screen.getByRole('button', { name: /open plan studio/i });
    planBtn.click();
    expect(dispatchedEvents.length).toBeGreaterThan(0);
    expect(dispatchedEvents[0]?.detail?.sessionId).toBe('sess-1');
  });

  it('files-touched row exists and dispatches goodboy:open-diff-viewer', async () => {
    const storeModule = await import('../store');
    vi.mocked(storeModule.useFilesTouched).mockReturnValueOnce({
      paths: ['a.ts'],
      count: 1,
    } as never);
    render(<ContextPanel session={makeSession()} collapsed={false} onCollapse={vi.fn()} />);
    const dispatchedEvents: CustomEvent[] = [];
    window.addEventListener('goodboy:open-diff-viewer', (e) => {
      dispatchedEvents.push(e as CustomEvent);
    });
    const diffBtn = screen.getByRole('button', { name: /files? touched/i });
    diffBtn.click();
    expect(dispatchedEvents.length).toBeGreaterThan(0);
    expect(dispatchedEvents[0]?.detail?.sessionId).toBe('sess-1');
    expect(dispatchedEvents[0]?.detail?.workingDir).toBe('/work/sess-1');
  });

  it('open-questions strip does not render when useSessionOpenQuestions returns empty', () => {
    render(<ContextPanel session={makeSession()} collapsed={false} onCollapse={vi.fn()} />);
    expect(screen.queryByText(/open question/i)).toBeNull();
  });

  it('open-questions strip renders when useSessionOpenQuestions returns open items', async () => {
    const storeModule = await import('../store');
    vi.mocked(storeModule.useSessionOpenQuestions).mockReturnValue([
      {
        id: 'q1',
        text: 'What is the approach?',
        sessionId: 'sess-1',
        status: 'open',
        suggestedAnswers: [],
        userAnswer: null,
      } as never,
    ]);
    render(<ContextPanel session={makeSession()} collapsed={false} onCollapse={vi.fn()} />);
    expect(screen.getByText(/1 open question/i)).toBeDefined();
    expect(screen.getByText(/unassigned/i)).toBeDefined();
    vi.mocked(storeModule.useSessionOpenQuestions).mockReturnValue([]);
  });

  it('files-touched row does not dispatch when workingDir is null', async () => {
    const storeModule = await import('../store');
    vi.mocked(storeModule.useFilesTouched).mockReturnValueOnce({
      paths: ['a.ts'],
      count: 1,
    } as never);
    vi.mocked(storeModule.useAppStore).mockImplementation((selector: (s: unknown) => unknown) => {
      const noWorktreeState = {
        upsertSessionSlot: vi.fn(),
        toggleSessionSlot: vi.fn(),
        loadSessionOpenQuestions: vi.fn().mockResolvedValue(undefined),
        loadSessionPlans: vi.fn().mockResolvedValue(undefined),
        reconcileSessionBranch: vi.fn().mockResolvedValue(undefined),
        loadSlotHistory: vi.fn().mockResolvedValue(undefined),
        retrySummarizer: vi.fn(),
        summarizerStatus: {},
        sessionTelemetry: {},
        sessionWorktrees: {},
        settings: {},
        githubStatus: null,
        sessionBranches: {},
        sessionGithub: {},
        sessionPendingResolutions: {},
        loadPendingResolutions: vi.fn().mockResolvedValue(undefined),
        pushAllResolutions: vi.fn().mockResolvedValue({ pushed: false, resolved: 0, failed: 0 }),
        sessions: [],
        workspaces: [],
        phaseTemplates: {},
        selectedAgentId: {},
        selectAgent: vi.fn().mockResolvedValue(undefined),
        requestOpenQuestionScroll: vi.fn(),
        refreshSessionPr: vi.fn(),
        refreshSessionPrDetail: vi.fn(),
        createPrForSession: vi.fn(),
        spawnAgent: vi.fn(),
        clearSessionNextActions: vi.fn(),
        loadDiffComments: vi.fn().mockResolvedValue(undefined),
        scriptRuns: {},
        terminalSessions: {},
        openTerminal: vi.fn().mockResolvedValue(undefined),
        closeTerminal: vi.fn().mockResolvedValue(undefined),
        terminalTabs: {},
        activeTerminalTab: {},
        addTerminalTab: vi.fn(() => 'sess-1::t1'),
        closeTerminalTab: vi.fn(),
        setActiveTerminalTab: vi.fn(),
        setTerminalTabStatus: vi.fn(),
        sessionPlans: {},
        sessionPhaseRuns: {},
        setPlanStatus: vi.fn(),
        updatePlanBody: vi.fn(),
        deletePlan: vi.fn(),
      };
      return selector(noWorktreeState);
    });
    render(<ContextPanel session={makeSession()} collapsed={false} onCollapse={vi.fn()} />);
    const diffBtn = screen.getByRole('button', { name: /files? touched/i });
    expect(diffBtn.getAttribute('disabled')).not.toBeNull();
  });

  it('plan button shows plan count when plans exist', async () => {
    const storeModule = await import('../store');
    vi.mocked(storeModule.useSessionPlans).mockReturnValueOnce([
      { id: 'p1', title: 'Plan A', status: 'active' },
      { id: 'p2', title: 'Plan B', status: 'consumed' },
    ] as never);
    render(<ContextPanel session={makeSession()} collapsed={false} onCollapse={vi.fn()} />);
    expect(screen.getByText(/2 plans/i)).toBeDefined();
  });
});
