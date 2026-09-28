// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { IsoDateTime, Session, SessionId, Workflow, WorkflowId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../store/storyHarness';
import { ToastProvider } from '../../app/components/Toast';
import { WORKSPACE_ID, seedBoardScene } from '../../app/components/MockScene/scenes/BoardScene';
import { SessionOverviewPane } from '../../features/session/components/SessionOverviewPane';
import { WorkflowBuilderView } from '../../features/session/components/WorkflowBuilderView';

type StoreState = ReturnType<StoryStore['getState']>;

const SESSION_ID = 'session-blank-start' as SessionId;
const NOW = '2026-09-27T09:00:00.000Z' as IsoDateTime;

const BLANK: Session = {
  id: SESSION_ID,
  workspaceId: WORKSPACE_ID,
  goal: '',
  state: { kind: 'draft' },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
  permissionMode: 'default',
  workflowRuns: [],
  autoRun: false,
  titleUserEdited: false,
  createdAt: NOW,
  updatedAt: NOW,
};

const workflowOf = ({
  id,
  name,
  origin,
}: {
  readonly id: string;
  readonly name: string;
  readonly origin: Workflow['origin'];
}): Workflow => ({
  id: id as WorkflowId,
  workspaceId: WORKSPACE_ID,
  name,
  description: `${name} for notify-relay`,
  steps: [],
  isPreset: true,
  origin,
  createdAt: NOW,
  updatedAt: NOW,
});

const BUILT_IN = workflowOf({ id: 'wf-fix-bug', name: 'Fix a bug', origin: 'library' });
const SAVED = workflowOf({
  id: 'wf-harborline-release',
  name: 'Harborline release',
  origin: 'custom',
});

let useAppStore: StoryStore;
let restore: Partial<StoreState> = {};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  seedBoardScene();
  const state = useAppStore.getState();
  restore = {
    saveSessionSetupGoal: state.saveSessionSetupGoal,
    loadPhaseTemplates: state.loadPhaseTemplates,
    loadSessionMounts: state.loadSessionMounts,
    loadPrSeries: state.loadPrSeries,
  };
  useAppStore.setState({
    sessions: [BLANK, ...state.sessions],
    currentSessionId: SESSION_ID,
    sessionPhaseRuns: { ...state.sessionPhaseRuns, [SESSION_ID]: [] },
    sessionSlots: { ...state.sessionSlots, [SESSION_ID]: [] },
    sessionProjectMounts: { ...state.sessionProjectMounts, [SESSION_ID]: [] },
    phaseTemplates: { ...state.phaseTemplates, [WORKSPACE_ID]: [BUILT_IN, SAVED] },
    loadPhaseTemplates: vi.fn(async () => undefined),
    loadSessionMounts: vi.fn(async () => []),
    loadPrSeries: vi.fn(async () => undefined),
    saveSessionSetupGoal: vi.fn(async ({ sessionId, goal }) => {
      useAppStore.setState((current) => ({
        sessionSlots: {
          ...current.sessionSlots,
          [sessionId]: [{ key: 'goal', value: goal, enabled: true }],
        },
      }));
    }),
  } as unknown as Partial<StoreState>);
});

afterEach(() => {
  cleanup();
  useAppStore.setState(restore);
  vi.restoreAllMocks();
});

const settle = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
};

const mountOverview = async (): Promise<void> => {
  render(
    <ToastProvider>
      <SessionOverviewPane session={BLANK} onSelectLens={() => undefined} />
    </ToastProvider>,
  );
  await settle();
};

const setupList = () => screen.getByRole('list', { name: 'Set up this session' });

const currentStep = () => within(setupList()).getByRole('listitem', { current: 'step' });

describe('session start: a blank session sets itself up on the overview', () => {
  it('lands with nothing required and the goal as the first step', async () => {
    await mountOverview();

    expect(within(currentStep()).getByText('Goal')).toBeDefined();
    expect(screen.getByRole('textbox', { name: 'Session goal' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Project' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Start the work' })).toBeDefined();
    expect(screen.queryByRole('region', { name: 'Activity' })).toBeNull();
  });

  it('saves the goal inline and moves to the project, then skips to the work', async () => {
    await mountOverview();

    fireEvent.change(screen.getByRole('textbox', { name: 'Session goal' }), {
      target: { value: 'Stop notify-relay from retrying settled webhooks.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save goal' }));

    await waitFor(() => expect(within(currentStep()).getByText('Project')).toBeDefined());
    expect(useAppStore.getState().saveSessionSetupGoal).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      goal: 'Stop notify-relay from retrying settled webhooks.',
    });
    expect(
      screen.getByRole('button', {
        name: 'Goal: Stop notify-relay from retrying settled webhooks.',
      }),
    ).toBeDefined();
    expect(within(currentStep()).getByRole('button', { name: 'Add notify-relay' })).toBeDefined();

    fireEvent.click(within(currentStep()).getByRole('button', { name: 'Skip' }));

    await waitFor(() => expect(within(currentStep()).getByText('Start the work')).toBeDefined());
    expect(screen.getByRole('button', { name: 'Project: Session folder' })).toBeDefined();
  });

  it('reopens a done step from its row', async () => {
    await mountOverview();
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Goal: No goal yet' }));

    expect(within(currentStep()).getByText('Goal')).toBeDefined();
  });

  it('lists presets, your workflows, orchestrated and custom, and opens the shared form prefilled', async () => {
    useAppStore.getState().focusSessionSetupStep({ sessionId: SESSION_ID, step: 'work' });
    await mountOverview();

    const yours = screen.getByRole('list', { name: 'Your workflows' });
    const builtIn = screen.getByRole('list', { name: 'Built in' });
    const scratch = screen.getByRole('list', { name: 'From scratch' });
    expect(within(yours).getByRole('button', { name: 'Harborline release' })).toBeDefined();
    expect(within(builtIn).getByRole('button', { name: 'Fix a bug' })).toBeDefined();
    expect(within(scratch).getByRole('button', { name: 'Orchestrated workflow' })).toBeDefined();
    expect(within(scratch).getByRole('button', { name: 'Custom workflow' })).toBeDefined();

    const opened = vi.fn();
    window.addEventListener('goodboy:open-workflow-builder', opened);
    fireEvent.click(within(builtIn).getByRole('button', { name: 'Fix a bug' }));
    window.removeEventListener('goodboy:open-workflow-builder', opened);

    expect(opened).toHaveBeenCalledOnce();
    expect((opened.mock.calls[0]?.[0] as CustomEvent).detail).toEqual({ sessionId: SESSION_ID });
    expect(useAppStore.getState().workflowDrafts[SESSION_ID]).toMatchObject({
      mode: 'preset',
      selectedPresetId: BUILT_IN.id,
    });

    cleanup();
    render(
      <ToastProvider>
        <WorkflowBuilderView session={BLANK} onClose={() => undefined} />
      </ToastProvider>,
    );
    await settle();

    const approach = screen.getByRole('tablist', { name: 'Workflow approach' });
    expect(
      within(approach)
        .getByRole('tab', { name: /Preset/ })
        .getAttribute('aria-selected'),
    ).toBe('true');
    expect(screen.getByPlaceholderText('Fix a bug')).toBeDefined();
  });

  it('opens the shared form on the orchestrated approach', async () => {
    useAppStore.getState().focusSessionSetupStep({ sessionId: SESSION_ID, step: 'work' });
    await mountOverview();

    fireEvent.click(screen.getByRole('button', { name: 'Orchestrated workflow' }));
    cleanup();
    render(
      <ToastProvider>
        <WorkflowBuilderView session={BLANK} onClose={() => undefined} />
      </ToastProvider>,
    );
    await settle();

    const approach = screen.getByRole('tablist', { name: 'Workflow approach' });
    expect(
      within(approach)
        .getByRole('tab', { name: /Orchestrated/ })
        .getAttribute('aria-selected'),
    ).toBe('true');
  });
});
