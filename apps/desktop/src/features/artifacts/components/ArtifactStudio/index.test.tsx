// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

const { notify, state, showToast, subscribers } = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  const nothing = (): unknown => null;
  const noRows = (): ReadonlyArray<unknown> => [];
  const noRecords = (): ReadonlyArray<Record<string, unknown>> => [];
  const noEntries = <Value,>(): Record<string, Value> => ({});
  const plansLens: Record<string, string | null> = { 'sess-1': 'plans' };
  return {
    subscribers: listeners,
    notify: () => {
      for (const listener of listeners) {
        listener();
      }
    },
    showToast: vi.fn(),
    state: {
      currentSessionId: 'sess-1',
      currentWorkspaceId: null,
      navigation: Object.fromEntries(Array.of<[string, never]>()),
      amendFocus: () => undefined,
      activeLens: plansLens,
      drawer: nothing(),
      appStudio: nothing(),
      sessionPhaseRuns: noEntries<ReadonlyArray<unknown>>(),
      phaseTemplates: noEntries<ReadonlyArray<unknown>>(),
      autoTreeViews: {},
      sessionArtifacts: noEntries<ReadonlyArray<unknown>>(),
      wireframeDrafts: noEntries<unknown>(),
      artifactComments: noEntries<ReadonlyArray<unknown>>(),
      artifactCommentSends: noEntries<true>(),
      loadArtifactComments: vi.fn(async () => undefined),
      addArtifactComment: vi.fn(async () => null),
      editArtifactComment: vi.fn(async () => true),
      removeArtifactComment: vi.fn(async () => true),
      sendArtifactComments: vi.fn(async () => ({ kind: 'empty' })),
      approveWorkflowRunPlan: vi.fn(async () => undefined),
      planConsumptions: noEntries<ReadonlyArray<unknown>>(),
      agentTurnState: noEntries<{ readonly kind: string }>(),
      transcripts: noEntries<ReadonlyArray<unknown>>(),
      loadSessionArtifacts: vi.fn(async () => undefined),
      loadConsumptionsForPlan: vi.fn(async () => undefined),
      updatePlanBody: vi.fn(async () => ({ kind: 'saved', revision: 2 })),
      updateArtifactSource: vi.fn(async () => undefined),
      markArtifactOpened: vi.fn(),
      runPlan: vi.fn(async () => 'agent-impl'),
      spawnReportAgent: vi.fn(async () => 'agent-report-3'),
      spawnWireframeAgent: vi.fn(async () => 'agent-wireframe-3'),
      navigate: vi.fn(
        ({
          to,
        }: {
          readonly to: {
            readonly at: string;
            readonly view?: { readonly target: { kind: string; artifactId?: string } | null };
          };
        }) => {
          const target = to.view?.target ?? null;
          if (to.at === 'session' && target?.kind === 'artifact') {
            state.focusedArtifactId = {
              ...state.focusedArtifactId,
              'sess-1': target.artifactId ?? null,
            };
            notify();
          }
        },
      ),
      up: vi.fn(() => {
        state.focusedArtifactId = { ...state.focusedArtifactId, 'sess-1': null };
        notify();
      }),
      loadAgentTranscript: vi.fn(async () => undefined),
      openDrawer: vi.fn(),
      toggleDrawer: vi.fn(),
      focusedArtifactId: noEntries<string | null>(),
      setFocusedArtifactId: vi.fn((sessionId: string, artifactId: string | null) => {
        state.focusedArtifactId = { ...state.focusedArtifactId, [sessionId]: artifactId };
        notify();
      }),
      artifactFilter: noEntries<string>(),
      setArtifactFilter: vi.fn(),
      sessions: noRecords(),
      workspaces: noRecords(),
      selectedAgentId: noEntries<string | null>(),
      awaitedArtifactAgentId: noEntries<string | null>(),
      awaitArtifactAgent: vi.fn(
        ({
          sessionId,
          agentId,
        }: {
          readonly sessionId: string;
          readonly agentId: string | null;
        }) => {
          state.awaitedArtifactAgentId = { ...state.awaitedArtifactAgentId, [sessionId]: agentId };
          notify();
        },
      ),
      focusedRunAgentId: {},
      setFocusedRunAgent: vi.fn(
        ({
          sessionId,
          agentId,
        }: {
          readonly sessionId: string;
          readonly agentId: string | null;
        }) => {
          state.focusedRunAgentId = { ...state.focusedRunAgentId, [sessionId]: agentId };
          notify();
        },
      ),
      openArtifactCreation: vi.fn(),
      setArtifactDraft: vi.fn(),
      stopArtifactGeneration: vi.fn(async () => undefined),
      wireframeScoutVerification: {},
      plans: noRows(),
      planStarts: noEntries<number>(),
      get sessionPlans(): Record<string, ReadonlyArray<unknown>> {
        return { 'sess-1': this.plans };
      },
      openQuestions: noRows(),
      sessionOpenQuestions: noEntries<ReadonlyArray<unknown>>(),
    },
  };
});

vi.mock('../../../../store', async () => {
  const react = await import('react');
  const useAppStore = <T,>(selector: (s: typeof state) => T): T => {
    const [, bump] = react.useReducer((count: number) => count + 1, 0);
    react.useEffect(() => {
      subscribers.add(bump);
      return () => {
        subscribers.delete(bump);
      };
    }, [bump]);
    return selector(state);
  };
  useAppStore.getState = () => state;
  useAppStore.subscribe = (listener: () => void) => {
    subscribers.add(listener);
    return () => {
      subscribers.delete(listener);
    };
  };
  return {
    ...(await import('../../../../store/slices/navigation/place')),
    EMPTY_ARRAY: Array.of<never>(),
    useAppStore,
    useSessionPlans: () => state.plans,
    useIsSessionCollectionLoaded: () => true,
    useSessionOpenQuestions: () => state.openQuestions,
  };
});

vi.mock('../../../../shared/components/Toast', () => ({
  useToast: () => ({ showToast }),
}));

vi.mock('../../useArtifactScoutRoster', () => ({
  useArtifactScoutRoster: () => ({ rows: [], isLoaded: true }),
}));

vi.mock('../../artifactProvenance', () => ({
  loadArtifactProvenance: vi.fn(async () => null),
}));

const report = {
  id: 'artifact-report',
  sessionId: 'sess-1',
  agentId: 'agent-1',
  workflowRunId: null,
  kind: 'report',
  schemaVersion: 1,
  title: 'Rounding drift in ledger-core postings',
  sourceFormat: 'markdown',
  sourceText: '## What was wrong\nEach posting rounded its own share.',
  metadata: { reportType: 'session-summary' },
  status: 'active',
  revision: 2,
  sourceTurnId: 'run-1',
  createdAt: '2026-09-14T18:27:00.000Z',
  updatedAt: '2026-09-14T18:27:00.000Z',
};

const wireframeDocument = {
  version: 1,
  initialScreenId: 'batches',
  theme: { name: 'generic' },
  screens: [
    {
      id: 'batches',
      title: 'Settlement batches',
      viewport: 'desktop',
      root: {
        id: 'batches-root',
        kind: 'stack',
        direction: 'column',
        children: [{ id: 'batches-title', kind: 'text', text: 'Batches', variant: 'title' }],
      },
    },
  ],
  transitions: [],
};

const wireframe = {
  ...report,
  id: 'artifact-wireframe',
  kind: 'wireframe',
  title: 'Settlement review flow',
  sourceFormat: 'json',
  sourceText: JSON.stringify(wireframeDocument),
  metadata: { fidelity: 'low', designProfile: {} },
  revision: 1,
  createdAt: '2026-09-14T18:34:00.000Z',
};

const plan = {
  id: 'plan-1',
  agentId: 'agent-planner',
  sessionId: 'sess-1',
  title: 'Backfill the settled batches',
  bodyMd: '## Goal\nEvery settled batch matches its invoice.',
  status: 'active',
  createdAt: '2026-09-14T19:34:00.000Z',
  updatedAt: '2026-09-14T19:34:00.000Z',
  consumptionCount: 0,
};

const reportAgent = {
  id: 'agent-report-2',
  name: 'Report 2',
  kind: 'report',
  status: 'completed',
  startedAt: '2026-09-14T18:00:00.000Z',
  lastFinishedAt: '2026-09-14T18:04:00.000Z',
};

beforeEach(() => {
  state.sessionPhaseRuns = {
    'sess-1': [
      { id: 'agent-1', name: 'Report 1' },
      { id: 'agent-planner', name: 'Planner 2' },
    ],
  };
  state.sessionArtifacts = {};
  state.planConsumptions = {};
  state.agentTurnState = {};
  state.transcripts = {};
  state.drawer = null;
  state.appStudio = null;
  state.activeLens = { 'sess-1': 'plans' };
  state.plans = [];
  state.openQuestions = [];
  state.focusedArtifactId = {};
  state.artifactFilter = {};
  state.sessions = [{ id: 'sess-1', goal: 'fix the rounding drift' }];
  state.selectedAgentId = {};
  state.awaitedArtifactAgentId = {};
  state.focusedRunAgentId = {};
  vi.clearAllMocks();
});
afterEach(cleanup);

import { ArtifactStudio } from './index';
import { sessionPlace } from '../../../../store/slices/navigation/place';
import { brandId, type ArtifactId, type SessionId } from '@goodboy/types';

const SESSION_ID = brandId<SessionId>({ value: 'sess-1' });

const renderStudio = () => render(<ArtifactStudio sessionId={SESSION_ID} />);

const openRow = (name: RegExp) => fireEvent.click(screen.getByRole('button', { name }));

const focus = (artifactId: string) => {
  state.focusedArtifactId = { 'sess-1': artifactId };
};

describe('ArtifactStudio list', () => {
  it('loads the session artifacts on mount', () => {
    renderStudio();
    expect(state.loadSessionArtifacts).toHaveBeenCalledWith('sess-1');
  });

  it('says there is nothing yet when the session has no artifact', () => {
    state.sessionArtifacts = { 'sess-1': [] };
    renderStudio();
    expect(screen.getByRole('heading', { level: 1, name: 'Artifacts' })).toBeDefined();
    expect(screen.getByText('No artifacts yet')).toBeDefined();
  });

  it('lists plans, reports and wireframes as rows of one group, newest first', () => {
    state.plans = [plan];
    state.sessionArtifacts = { 'sess-1': [report, wireframe] };
    renderStudio();
    const list = screen.getByTestId('artifact-list');
    const titles = Array.from(list.querySelectorAll('[data-artifact-row]')).map((button) =>
      button.getAttribute('aria-label'),
    );
    expect(titles).toEqual([
      'Plan Backfill the settled batches, Ready to run',
      'Wireframe Settlement review flow, Ready',
      'Report Rounding drift in ledger-core postings, Ready',
    ]);
    expect(within(list).getByRole('heading', { name: /^Ready$/ })).toBeDefined();
    within(list).getByRole('heading', { name: /^To read 2$/ });
    expect(screen.queryByText(/Show finished/)).toBeNull();
  });

  it('records the picked filter and shows only that kind', () => {
    state.plans = [plan];
    state.sessionArtifacts = { 'sess-1': [report, wireframe] };
    state.artifactFilter = { 'sess-1': 'report' };
    renderStudio();
    expect(screen.getByText('Rounding drift in ledger-core postings')).toBeDefined();
    expect(screen.queryByText('Settlement review flow')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: /plans/i }));
    expect(state.setArtifactFilter).toHaveBeenCalledWith({ sessionId: 'sess-1', filter: 'plan' });
  });

  it('starts a report or a wireframe from one New menu', () => {
    renderStudio();
    fireEvent.click(screen.getByTestId('artifact-new'));
    const menu = screen.getByRole('menu', { name: 'New artifact' });
    fireEvent.click(within(menu).getByRole('menuitem', { name: /Wireframe/ }));
    expect(state.openArtifactCreation).toHaveBeenCalledWith({
      sessionId: 'sess-1',
      kind: 'wireframe',
      workflowRunId: null,
    });
    expect(screen.queryByTestId('create-report-cta')).toBeNull();
  });

  it('shows a generation as a running row with a stop control', () => {
    state.sessionPhaseRuns = {
      'sess-1': [{ ...reportAgent, status: 'running', lastFinishedAt: undefined }],
    };
    state.agentTurnState = { 'agent-report-2': { kind: 'running' } };
    renderStudio();
    expect(screen.getByRole('heading', { level: 2, name: /^Running/ })).toBeDefined();
    expect(screen.queryByTestId('artifact-row-state')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(state.stopArtifactGeneration).toHaveBeenCalledWith({
      sessionId: 'sess-1',
      agentId: 'agent-report-2',
    });
  });

  it('offers try again on a generation that produced nothing', async () => {
    state.sessionPhaseRuns = { 'sess-1': [reportAgent] };
    renderStudio();
    expect(screen.getByText('Stopped')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => {
      expect(state.openArtifactCreation).toHaveBeenCalledWith({
        sessionId: 'sess-1',
        kind: 'report',
        workflowRunId: null,
        note: 'the brief of this generation was not recorded',
      });
    });
  });

  it('opens the agent behind a generation that produced nothing', () => {
    state.sessionPhaseRuns = { 'sess-1': [reportAgent] };
    renderStudio();
    openRow(/^Report Report 2,/);
    expect(state.navigate).toHaveBeenCalledWith({
      to: { at: 'agent', sessionId: 'sess-1', agentId: 'agent-report-2' },
    });
  });

  it('opens the reader when the awaited artifact arrives, and stops waiting', () => {
    state.awaitedArtifactAgentId = { 'sess-1': 'agent-report-2' };
    const { rerender } = renderStudio();
    expect(state.setFocusedArtifactId).not.toHaveBeenCalled();
    state.sessionArtifacts = { 'sess-1': [{ ...report, agentId: 'agent-report-2' }] };
    rerender(<ArtifactStudio sessionId={SESSION_ID} />);
    expect(state.navigate).toHaveBeenLastCalledWith({
      to: sessionPlace({
        sessionId: SESSION_ID,
        lens: 'plans',
        target: { kind: 'artifact', artifactId: brandId<ArtifactId>({ value: 'artifact-report' }) },
      }),
      mode: 'replace',
    });
    expect(state.awaitArtifactAgent).toHaveBeenLastCalledWith({
      sessionId: 'sess-1',
      agentId: null,
    });
  });

  it.each([
    ['Settings', { appStudio: { kind: 'settings' }, drawer: null }],
    ['a drawer', { appStudio: null, drawer: { kind: 'new', sessionId: 'sess-1' } }],
  ])('leaves %s open when the awaited artifact arrives', (_name, over) => {
    state.awaitedArtifactAgentId = { 'sess-1': 'agent-report-2' };
    state.appStudio = over.appStudio;
    state.drawer = over.drawer;
    const { rerender } = renderStudio();
    state.sessionArtifacts = { 'sess-1': [{ ...report, agentId: 'agent-report-2' }] };
    rerender(<ArtifactStudio sessionId={brandId<SessionId>({ value: 'sess-1' })} />);
    expect(state.navigate).not.toHaveBeenCalled();
    expect(state.awaitArtifactAgent).toHaveBeenLastCalledWith({
      sessionId: 'sess-1',
      agentId: null,
    });
  });

  it('opens a plan and a report through the same artifact focus', () => {
    state.plans = [plan];
    state.sessionArtifacts = { 'sess-1': [report] };
    renderStudio();
    openRow(/^Plan Backfill the settled batches/);
    expect(state.navigate).toHaveBeenLastCalledWith({
      to: sessionPlace({
        sessionId: SESSION_ID,
        lens: 'plans',
        target: { kind: 'artifact', artifactId: brandId<ArtifactId>({ value: 'plan-1' }) },
      }),
      mode: 'push',
    });
    expect(screen.getByTestId('artifact-shell').getAttribute('data-artifact-kind')).toBe('plan');
  });
});

describe('ArtifactStudio shell', () => {
  it('opens a report in the shared shell: title once, meta line, Edit and More, no tabs', () => {
    state.sessionArtifacts = { 'sess-1': [report] };
    focus('artifact-report');
    renderStudio();
    const header = screen.getByTestId('artifact-shell-header');
    expect(within(header).getByRole('heading', { level: 1 }).textContent).toBe(
      'Rounding drift in ledger-core postings',
    );
    expect(within(header).getByTestId('artifact-creator').textContent).toBe('Report 1');
    expect(within(header).getByText('v2')).toBeDefined();
    expect(within(header).getByTestId('artifact-action-edit')).toBeDefined();
    expect(within(header).queryByTestId('artifact-action-runPlan')).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Conversation' })).toBeNull();
    expect(screen.getByText('Each posting rounded its own share.')).toBeDefined();
  });

  it('lists every action behind More, the buttoned Edit included and Open left out, in the registry order', () => {
    state.sessionArtifacts = { 'sess-1': [report] };
    focus('artifact-report');
    renderStudio();
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    const menu = screen.getByRole('menu', { name: 'More' });
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual([
      'Edit',
      expect.stringContaining('Regenerate'),
      'Copy markdown',
      'Save markdown to…',
      expect.stringContaining('Open in browser'),
      expect.stringContaining('Show in Finder'),
      expect.stringContaining('Delete'),
    ]);
  });

  it('edits a report in place and saves the source on Save', async () => {
    state.sessionArtifacts = { 'sess-1': [report] };
    focus('artifact-report');
    renderStudio();
    fireEvent.click(screen.getByTestId('artifact-action-edit'));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '## Rewritten' } });
    fireEvent.click(screen.getByTestId('artifact-save'));
    await waitFor(() => {
      expect(state.updateArtifactSource).toHaveBeenCalledWith({
        sessionId: 'sess-1',
        artifactId: 'artifact-report',
        title: 'Rounding drift in ledger-core postings',
        sourceFormat: 'markdown',
        sourceText: '## Rewritten',
        metadata: { reportType: 'session-summary' },
      });
    });
  });

  it('drops an edit on Cancel without saving', () => {
    state.sessionArtifacts = { 'sess-1': [report] };
    focus('artifact-report');
    renderStudio();
    fireEvent.click(screen.getByTestId('artifact-action-edit'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(state.updateArtifactSource).not.toHaveBeenCalled();
  });

  it('runs a ready plan from its one primary', async () => {
    state.plans = [plan];
    focus('plan-1');
    renderStudio();
    fireEvent.click(screen.getByTestId('artifact-action-runPlan'));
    await waitFor(() => expect(state.runPlan).toHaveBeenCalledWith('sess-1', 'plan-1'));
  });

  it('saves a plan edit as title and body', async () => {
    state.plans = [plan];
    focus('plan-1');
    renderStudio();
    fireEvent.click(screen.getByTestId('artifact-action-edit'));
    const textbox = screen.getByRole<HTMLTextAreaElement>('textbox');
    expect(textbox.value).toBe(
      '# Backfill the settled batches\n\n## Goal\nEvery settled batch matches its invoice.',
    );
    fireEvent.change(textbox, { target: { value: '# Backfill once\n\n## Goal\nmatch' } });
    fireEvent.click(screen.getByTestId('artifact-save'));
    await waitFor(() =>
      expect(state.updatePlanBody).toHaveBeenCalledWith(
        'sess-1',
        'plan-1',
        'Backfill once',
        '## Goal\nmatch',
        1,
      ),
    );
  });

  it('offers Delete on a plan that already ran, and asks before running it again', async () => {
    state.plans = [{ ...plan, status: 'consumed', consumptionCount: 1 }];
    focus('plan-1');
    renderStudio();
    expect(screen.queryByTestId('artifact-action-runPlan')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    const menu = screen.getByRole('menu', { name: 'More' });
    expect(within(menu).getByRole('menuitem', { name: /Delete/ })).toBeDefined();
    fireEvent.keyDown(menu, { key: 'Escape' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(state.setFocusedArtifactId).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('artifact-action-runAgain'));
    expect(state.runPlan).not.toHaveBeenCalled();
    const confirm = screen.getByRole('dialog', { name: 'Run this plan again?' });
    expect(screen.getByTestId('artifact-shell-header').contains(confirm)).toBe(false);
    fireEvent.click(within(confirm).getByRole('button', { name: 'Run again' }));
    await waitFor(() => expect(state.runPlan).toHaveBeenCalledWith('sess-1', 'plan-1'));
  });

  it('opens Details and Chat in the right drawer instead of inline tabs', () => {
    state.sessionArtifacts = { 'sess-1': [report] };
    focus('artifact-report');
    renderStudio();
    fireEvent.click(screen.getByTestId('artifact-drawer-details'));
    expect(state.toggleDrawer).toHaveBeenCalledWith({
      kind: 'artifact',
      sessionId: 'sess-1',
      payload: { artifactId: 'artifact-report', tab: 'details' },
    });
    expect(screen.queryByTestId('artifact-built-from-link')).toBeNull();
  });

  it('leaves Escape on an artifact page to the session ladder, which owns the way up', async () => {
    state.sessionArtifacts = { 'sess-1': [report] };
    focus('artifact-report');
    renderStudio();
    fireEvent.keyDown(window, { key: 'Escape' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(state.up).not.toHaveBeenCalled();
    expect(state.focusedArtifactId['sess-1']).toBe('artifact-report');
    screen.getByTestId('artifact-shell');
  });

  it('says an artifact is gone when its address no longer matches one, instead of the list', () => {
    state.sessionArtifacts = { 'sess-1': [report] };
    focus('artifact-deleted');
    renderStudio();
    expect(screen.queryByText('This artifact is no longer in this session')).not.toBeNull();
    expect(screen.queryByTestId('artifact-list')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(state.up).toHaveBeenCalled();
  });

  it('waits for the artifacts to load before it calls an address gone', () => {
    focus('artifact-report');
    renderStudio();
    expect(screen.queryByText('This artifact is no longer in this session')).toBeNull();
  });

  it('opens a wireframe on its flow, with Open in browser as the secondary and the variant under More', () => {
    state.sessionArtifacts = { 'sess-1': [wireframe] };
    focus('artifact-wireframe');
    renderStudio();
    expect(screen.getByTestId('wireframe-viewer').getAttribute('data-view')).toBe('flow');
    expect(screen.getByTestId('artifact-action-openInBrowser')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /New variant/ }));
    expect(state.spawnWireframeAgent).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 'sess-1', fidelity: 'high' }),
    );
  });

  it('copies the spec from More', async () => {
    const writeText = vi.fn(async (text: string) => text.length);
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    state.sessionArtifacts = { 'sess-1': [wireframe] };
    focus('artifact-wireframe');
    renderStudio();
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Copy spec/ }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
  });

  it('opens a plan another surface focused, as a plan', () => {
    state.plans = [plan];
    focus('plan-1');
    renderStudio();
    expect(screen.getByTestId('artifact-shell').getAttribute('data-artifact-kind')).toBe('plan');
    expect(screen.getByText('Every settled batch matches its invoice.')).toBeDefined();
  });
});

describe('ArtifactStudio plan parts', () => {
  const clusters = [
    {
      title: 'Add a dry run to the backfill job',
      instructions: 'add a flag',
      doneWhen: ['run pnpm test ledger-core'],
      touches: ['ledger-core/src/backfill.ts', 'ledger-core/src/flags.ts'],
    },
    { title: 'Skip settled batches in retries', instructions: 'notify-relay' },
  ];

  it('lists the parts after the goal and says how they run in one line', async () => {
    state.plans = [
      {
        ...plan,
        bodyMd: '## Goal\nEvery settled batch matches its invoice.\n\n## Risks\nnone',
        clusters,
      },
    ];
    focus('plan-1');
    renderStudio();
    const parts = screen.getByTestId('plan-parts');
    expect(within(parts).getByText('2 parts, one after the other.')).toBeDefined();
    fireEvent.mouseEnter(within(parts).getByText('2 parts, one after the other.'));
    await screen.findByText(
      'Parts that touch the same files go one after the other; the rest can run together.',
    );
    expect(within(parts).getByText('Done when: run pnpm test ledger-core')).toBeDefined();
    expect(within(parts).getByText('2 files')).toBeDefined();
    expect(within(parts).getAllByText('Auto')).toHaveLength(2);
    const body = screen.getByTestId('plan-body');
    expect(body.textContent?.indexOf('Every settled batch')).toBeLessThan(
      body.textContent?.indexOf('Parts') ?? 0,
    );
    fireEvent.click(within(parts).getByRole('button', { name: /Part 2, Skip settled/ }));
    expect(state.openDrawer).toHaveBeenCalledWith({
      kind: 'plan-part',
      sessionId: 'sess-1',
      payload: { planId: 'plan-1', index: 1 },
    });
  });

  it('gives each part the state of its subagent once the plan runs, and hides run again', () => {
    state.plans = [
      {
        ...plan,
        clusters,
        status: 'consumed',
        consumptionCount: 1,
        lastConsumer: { agentId: 'agent-impl', name: 'Implementer 3' },
      },
    ];
    state.sessionPhaseRuns = {
      'sess-1': [
        { id: 'agent-planner', name: 'Planner 2', ordinal: 0 },
        { id: 'agent-impl', name: 'Implementer 3', status: 'running', ordinal: 1 },
        {
          id: 'agent-part-1',
          name: 'Add a dry run',
          parentAgentId: 'agent-impl',
          status: 'completed',
          ordinal: 2,
        },
        {
          id: 'agent-part-2',
          name: 'Skip settled',
          parentAgentId: 'agent-impl',
          status: 'running',
          ordinal: 3,
        },
      ],
    };
    focus('plan-1');
    renderStudio();
    expect(screen.queryByTestId('artifact-state-chip')).toBeNull();
    expect(screen.getByTestId('artifact-state-word').textContent).toContain('Running');
    expect(screen.queryByTestId('artifact-action-runAgain')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Part 1, Add a dry run/ }));
    expect(state.navigate).toHaveBeenCalledWith({
      to: { at: 'agent', sessionId: 'sess-1', agentId: 'agent-part-1' },
    });
  });
});

describe('ArtifactStudio generating run', () => {
  beforeEach(() => {
    state.sessionPhaseRuns = {
      'sess-1': [
        {
          ...reportAgent,
          id: 'agent-wireframe-live',
          name: 'High fidelity',
          kind: 'wireframe',
          status: 'running',
          lastFinishedAt: undefined,
        },
      ],
    };
    state.agentTurnState = { 'agent-wireframe-live': { kind: 'running' } };
  });

  it('opens the run in the same shell, with Stop as its secondary and the agent under More', () => {
    renderStudio();
    openRow(/^Wireframe High fidelity,/);
    expect(screen.getByTestId('artifact-run-detail')).toBeDefined();
    fireEvent.click(screen.getByTestId('artifact-action-stop'));
    expect(state.stopArtifactGeneration).toHaveBeenCalledWith({
      sessionId: 'sess-1',
      agentId: 'agent-wireframe-live',
    });
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Open agent/ }));
    expect(state.navigate).toHaveBeenCalledWith({
      to: { at: 'agent', sessionId: 'sess-1', agentId: 'agent-wireframe-live' },
    });
  });

  it('says in one sentence that it is still writing, with no placeholder bars', () => {
    renderStudio();
    openRow(/^Wireframe High fidelity,/);

    expect(screen.getByTestId('artifact-writing').textContent).toBe(
      'Still writing. It opens here when the agent is done.',
    );
    expect(document.querySelector('[aria-hidden][class*="animate"]')).toBeNull();
  });

  it('follows the agent writing it from a visible Follow button', () => {
    renderStudio();
    openRow(/^Wireframe High fidelity,/);

    fireEvent.click(screen.getByTestId('artifact-follow'));

    expect(state.navigate).toHaveBeenCalledWith({
      to: { at: 'agent', sessionId: 'sess-1', agentId: 'agent-wireframe-live' },
    });
  });

  it('goes back to the list on Escape from a run that has no address of its own', async () => {
    renderStudio();
    openRow(/^Wireframe High fidelity,/);
    screen.getByTestId('artifact-run-detail');
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('artifact-run-detail')).toBeNull());
    expect(state.up).not.toHaveBeenCalled();
  });

  it('leaves Escape to the session ladder once the page is no longer the one on screen', () => {
    renderStudio();
    openRow(/^Wireframe High fidelity,/);
    state.activeLens = { 'sess-1': 'workflows' };
    act(() => notify());
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('artifact-run-detail')).not.toBeNull();
  });

  it('follows the run to the artifact it produced', () => {
    const { rerender } = renderStudio();
    openRow(/^Wireframe High fidelity,/);
    state.sessionArtifacts = { 'sess-1': [{ ...wireframe, agentId: 'agent-wireframe-live' }] };
    rerender(<ArtifactStudio sessionId={SESSION_ID} />);
    expect(state.focusedArtifactId['sess-1']).toBe('artifact-wireframe');
  });
});
