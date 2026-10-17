// @vitest-environment happy-dom

import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { EffortLevel, Session, Workflow } from '@goodboy/types';
import type { Mode, WorkflowBuilderDraft } from '../../../../store/slices/workflowDrafts/types';

const {
  mockSavePhaseTemplate,
  mockAttach,
  mockPolish,
  mockGenerateWorkflowTitle,
  mockSuggestTitle,
  mockDeleteWorkflow,
  mockRestoreWorkflowSnapshot,
  toastMock,
  storeState,
} = vi.hoisted(() => ({
  mockSavePhaseTemplate: vi.fn(async (_workflow: Workflow) => undefined),
  mockAttach: vi.fn(async () => undefined),
  mockPolish: vi.fn(),
  mockGenerateWorkflowTitle: vi.fn(async () => undefined),
  mockSuggestTitle: vi.fn(
    async (_sessionId: string, _goal: string): Promise<string | null> => null,
  ),
  mockDeleteWorkflow: vi.fn(async () => undefined),
  mockRestoreWorkflowSnapshot: vi.fn(async (_input: unknown) => true),
  toastMock: vi.fn(),
  storeState: {
    phaseTemplates: {} as Record<string, ReadonlyArray<Workflow>>,
    sessionPhaseRuns: {} as Record<string, ReadonlyArray<unknown>>,
    workspaceOverrides: {},
    workflowDrafts: {} as Record<string, WorkflowBuilderDraft | undefined>,
    providers: [] as ReadonlyArray<{ id: string; connection: string }>,
    workspaceDurationHistory: {} as Record<string, unknown>,
  },
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => undefined) }));

vi.mock('../../../../store', () => {
  const setWorkflowDraft = (sessionId: string, draft: WorkflowBuilderDraft) => {
    storeState.workflowDrafts = { ...storeState.workflowDrafts, [sessionId]: draft };
  };
  const clearWorkflowDraft = (sessionId: string) => {
    const next = { ...storeState.workflowDrafts };
    delete next[sessionId];
    storeState.workflowDrafts = next;
  };
  const getState = () => ({
    sessions: [session],
    settings: {},
    loadSetting: async () => null,
    workspaces: [{ id: session.workspaceId, rootPath: '/tmp/repo', kind: 'repo' }],
    projects: [],
    sessionProjectMounts: {},
    sessionActiveProject: {},
    sessionWorktrees: { [session.id]: ['/tmp/worktree'] },
    sessionBranches: { [session.id]: 'ak/workflow' },
    savePhaseTemplate: mockSavePhaseTemplate,
    attachWorkflowToSession: mockAttach,
    generateWorkflowTitle: mockGenerateWorkflowTitle,
    suggestWorkflowTitle: mockSuggestTitle,
    deleteWorkflow: mockDeleteWorkflow,
    restoreWorkflowSnapshot: mockRestoreWorkflowSnapshot,
    phaseTemplates: storeState.phaseTemplates,
    sessionPhaseRuns: storeState.sessionPhaseRuns,
    providers: storeState.providers,
    workspaceOverrides: storeState.workspaceOverrides,
    workflowDrafts: storeState.workflowDrafts,
    workspaceDurationHistory: storeState.workspaceDurationHistory,
    loadWorkspaceDurationHistory: vi.fn(async () => undefined),
    setWorkflowDraft,
    clearWorkflowDraft,
  });
  const useAppStore = Object.assign(
    <T,>(selector: (s: never) => T) => selector(getState() as never),
    { getState },
  );
  const useSessionSlots = (sessionId: string | null) =>
    sessionId === null ? [] : [{ key: 'goal', value: 'do a thing' }];
  const useCurrentWorkspace = () => ({ name: 'Test workspace' });
  return { EMPTY_ARRAY: Object.freeze([]), useAppStore, useCurrentWorkspace, useSessionSlots };
});

vi.mock('../../../../shared/components/Toast', () => ({
  useToast: () => ({ showToast: toastMock }),
}));

vi.mock('../../../../store/slices/worktrees/useSessionRepo', () => ({
  useSessionRepo: () => ({
    repoRoot: '/tmp/repo',
    worktreePath: '/tmp/worktree',
    branch: 'ak/workflow',
    mountName: null,
    workspaceId: 'ws-1',
  }),
}));

vi.mock('@goodboy/core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@goodboy/core')>();
  return {
    ...original,
    polishWorkflowGoal: mockPolish,
  };
});

vi.mock('../../../../shared/components/RoutingPicker', () => ({
  RoutingPicker: ({
    connectedProviders,
    provider,
    model,
    recommendation,
    onChange,
    onReset,
    effort,
    ariaLabel,
  }: {
    connectedProviders: ReadonlyArray<string>;
    provider: string;
    model: string;
    recommendation?: { provider?: string; model?: string };
    onChange: (route: { provider: string; model: string; effort: EffortLevel }) => void;
    onReset?: () => void;
    ariaLabel?: string;
    effort:
      | { readonly editable: false; readonly value?: EffortLevel }
      | { readonly editable: true; readonly value: EffortLevel };
  }) => {
    const held = effort.value ?? 'medium';
    const heldProvider = provider === '' ? (recommendation?.provider ?? 'anthropic') : provider;
    const heldModel = model === '' ? (recommendation?.model ?? 'claude-sonnet-4-6') : model;
    return (
      <div
        role="group"
        aria-label={ariaLabel}
        data-offered-providers={connectedProviders.join(',')}
      >
        <button
          type="button"
          data-provider={provider === '' ? 'default' : provider}
          data-recommended-model={recommendation?.model}
          onClick={() =>
            onChange({ provider: heldProvider, model: 'claude-opus-4-6', effort: held })
          }
        >
          model:{model === '' ? 'auto' : model}
        </button>
        <button
          type="button"
          onClick={() =>
            onChange({ provider: heldProvider, model: 'claude-sonnet-4-6', effort: 'high' })
          }
        >
          model:sonnet
        </button>
        {effort.editable ? (
          <button
            type="button"
            onClick={() => onChange({ provider: heldProvider, model: heldModel, effort: 'xhigh' })}
          >
            effort:{effort.value}
          </button>
        ) : null}
        {onReset != null ? (
          <button type="button" onClick={onReset}>
            reset routing
          </button>
        ) : null}
      </div>
    );
  },
}));

import { WorkflowBuilderView, type BuilderKickoff } from './index';

let currentMode: Mode = 'dynamic';

const session: Session = {
  id: 'sess-1',
  workspaceId: 'ws-1',
  goal: 'do a thing',
  providerPreference: { defaultProvider: 'anthropic' },
} as unknown as Session;

const presetWorkflow = (id: string, name: string): Workflow =>
  ({
    id,
    workspaceId: 'ws-1',
    name,
    description: 'preset desc',
    steps: [
      {
        id: `${id}-step-0`,
        workflowId: id,
        ordinal: 0,
        name: 'Scout',
        role: 'scout',
        effort: 'medium',
        verbosity: 'normal',
      },
      {
        id: `${id}-step-1`,
        workflowId: id,
        ordinal: 1,
        name: 'Implement',
        role: 'implementer',
        effort: 'medium',
        verbosity: 'normal',
      },
    ],
    isPreset: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }) as unknown as Workflow;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  storeState.phaseTemplates = {};
  storeState.sessionPhaseRuns = {};
  storeState.workspaceOverrides = {};
  storeState.workflowDrafts = {};
  storeState.providers = [];
  storeState.workspaceDurationHistory = {};
  localStorage.clear();
});

type RememberModeParams = {
  readonly mode: Mode;
};

const rememberMode = ({ mode }: RememberModeParams) => {
  beforeEach(() => {
    currentMode = mode;
  });
  afterEach(() => {
    currentMode = 'dynamic';
  });
};

const goalField = () =>
  screen.getByPlaceholderText(/What should this run get done/i) as HTMLTextAreaElement;

const startBtn = () =>
  screen.getByRole('button', { name: /^(start (run|orchestration)|retry)$/i }) as HTMLButtonElement;

const setGoal = () => {
  if (goalField().value.trim().length === 0) {
    fireEvent.change(goalField(), { target: { value: 'test goal' } });
  }
};

const presetChip = () => screen.getByRole('button', { name: /^Preset:/ });

const orchestratorPicker = () => screen.getByRole('group', { name: /orchestrator routing/i });

const chooseAutonomy = (name: string) => {
  fireEvent.click(screen.getByRole('button', { name: /^autonomy:/i }));
  fireEvent.click(screen.getByRole('radio', { name: new RegExp(`^${name}`, 'i') }));
};

const openChip = (label: RegExp) => fireEvent.click(screen.getByRole('button', { name: label }));

const pickPreset = (name: RegExp) => {
  openChip(/^preset:/i);
  fireEvent.click(screen.getByRole('option', { name }));
};

const openSpendCap = () => openChip(/^limit:/i);

const GUIDANCE_TEXT = 'Inspect each result and stop after tests pass.';

const guidanceField = () => {
  const toggle = screen.queryByRole('button', { name: /^add guidance/i });
  if (toggle !== null) {
    fireEvent.click(toggle);
  }
  return screen.getByLabelText('Run guidance');
};

const writeGuidance = () => {
  fireEvent.change(guidanceField(), { target: { value: GUIDANCE_TEXT } });
};

const stepModelButton = (name: string) => screen.getByRole('button', { name: `Model for ${name}` });

const openStepModel = (name: string) => {
  fireEvent.click(stepModelButton(name));
  return within(screen.getByRole('dialog', { name: `Model for ${name}` }));
};

const laneSteps = () =>
  Array.from(document.querySelectorAll('[data-lane-step]')).map((row) =>
    row.getAttribute('data-lane-step'),
  );

describe('WorkflowBuilderView (orchestrate)', () => {
  it('starts from the goal alone and leaves the process out of the run', async () => {
    render(<WorkflowBuilderView mode={currentMode} session={session} onClose={vi.fn()} />);
    setGoal();

    expect(screen.getByRole('button', { name: /^add guidance/i })).toBeDefined();
    expect(startBtn().disabled).toBe(false);
    fireEvent.click(startBtn());

    await waitFor(() => expect(mockSavePhaseTemplate).toHaveBeenCalledOnce());
    const saved = mockSavePhaseTemplate.mock.calls[0]![0];
    expect(saved.processText).toBeUndefined();
    expect(saved.name).toBe('Orchestrated workflow');
    expect(saved.isPreset).toBe(false);
    await waitFor(() =>
      expect(mockAttach).toHaveBeenCalledWith('sess-1', saved.id, {
        autoRun: false,
        navigate: true,
        rulesSnapshot: expect.objectContaining({ autonomy: 'step' }),
        goal: 'test goal',
        executionMode: 'dynamic',
      }),
    );
  });

  it('names the run by default and titles it from the goal, with no name field', async () => {
    render(<WorkflowBuilderView mode={currentMode} session={session} onClose={vi.fn()} />);
    setGoal();
    expect(screen.queryByLabelText('Workflow name')).toBeNull();

    expect(startBtn().disabled).toBe(false);
    fireEvent.click(startBtn());

    await waitFor(() => expect(mockSavePhaseTemplate).toHaveBeenCalledOnce());
    expect(mockSavePhaseTemplate.mock.calls[0]![0].name).toBe('Orchestrated workflow');
    expect(mockGenerateWorkflowTitle).toHaveBeenCalledOnce();
  });

  it('carries the guidance onto a zero-step dynamic workflow', async () => {
    render(<WorkflowBuilderView mode={currentMode} session={session} onClose={vi.fn()} />);
    setGoal();
    writeGuidance();

    expect(startBtn().disabled).toBe(false);
    fireEvent.click(startBtn());
    await waitFor(() => expect(mockSavePhaseTemplate).toHaveBeenCalledOnce());
    const saved = mockSavePhaseTemplate.mock.calls[0]![0];
    expect(saved.processText).toBe(GUIDANCE_TEXT);
    expect(saved.steps).toEqual([]);
    await waitFor(() =>
      expect(mockAttach).toHaveBeenCalledWith(
        'sess-1',
        saved.id,
        expect.objectContaining({
          rulesSnapshot: expect.objectContaining({ standingGuidance: GUIDANCE_TEXT }),
        }),
      ),
    );
    expect(mockGenerateWorkflowTitle).toHaveBeenCalledWith(
      'ws-1',
      saved.id,
      'sess-1',
      'Orchestrated workflow',
      'test goal',
      GUIDANCE_TEXT,
    );
  });

  it('keeps the reason visible whenever start is disabled', () => {
    render(<WorkflowBuilderView mode={currentMode} session={session} onClose={vi.fn()} />);

    const described = startBtn().getAttribute('aria-describedby');
    expect(startBtn().hasAttribute('disabled')).toBe(true);
    expect(document.getElementById(described ?? '')?.textContent).toBe('Set a goal to start');
  });

  it('says why an unparsable spend cap blocks start instead of going mute', () => {
    render(<WorkflowBuilderView mode={currentMode} session={session} onClose={vi.fn()} />);
    setGoal();
    openSpendCap();
    fireEvent.click(screen.getByRole('switch', { name: /^limit$/i }));
    fireEvent.change(screen.getByLabelText('Limit in dollars'), {
      target: { value: 'not a number' },
    });

    expect(startBtn().hasAttribute('disabled')).toBe(true);
    expect(screen.getByText('Enter a valid limit to start')).toBeDefined();
  });

  it('keeps spend cap collapsed until enabled and carries the amount and outcome', async () => {
    render(<WorkflowBuilderView mode={currentMode} session={session} onClose={vi.fn()} />);
    setGoal();
    openSpendCap();
    expect(screen.queryByLabelText('Limit in dollars')).toBeNull();

    fireEvent.click(screen.getByRole('switch', { name: /^limit$/i }));
    fireEvent.change(screen.getByLabelText('Limit in dollars'), { target: { value: '15' } });
    fireEvent.click(screen.getByRole('tab', { name: /Warn only/ }));
    fireEvent.click(startBtn());

    await waitFor(() => expect(mockAttach).toHaveBeenCalledOnce());
    expect(mockAttach).toHaveBeenCalledWith('sess-1', expect.any(String), {
      autoRun: false,
      navigate: true,
      rulesSnapshot: expect.objectContaining({ autonomy: 'step' }),
      goal: 'test goal',
      executionMode: 'dynamic',
      spendLimitUsd: 15,
      spendLimitMode: 'notify',
    });
  });

  it('leaves the run uncapped when the spend cap is left empty', async () => {
    render(<WorkflowBuilderView mode={currentMode} session={session} onClose={vi.fn()} />);
    setGoal();
    fireEvent.click(startBtn());

    await waitFor(() => expect(mockAttach).toHaveBeenCalledOnce());
    expect(mockAttach).toHaveBeenCalledWith(
      'sess-1',
      expect.any(String),
      expect.not.objectContaining({ spendLimitUsd: expect.anything() }),
    );
  });

  it('starts and closes even when title generation never resolves', async () => {
    mockGenerateWorkflowTitle.mockImplementationOnce(() => new Promise(() => {}));
    const onClose = vi.fn();
    render(<WorkflowBuilderView mode={currentMode} session={session} onClose={onClose} />);
    setGoal();
    fireEvent.click(startBtn());

    await waitFor(() => expect(mockAttach).toHaveBeenCalledOnce());
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });

  it('does not generate a title for a preset', async () => {
    storeState.phaseTemplates = { 'ws-1': [presetWorkflow('wf-preset-1', 'Ship It')] };
    render(<WorkflowBuilderView mode="preset" session={session} onClose={vi.fn()} />);
    setGoal();
    pickPreset(/ship it/i);
    fireEvent.click(startBtn());
    await waitFor(() => expect(mockAttach).toHaveBeenCalledOnce());
    expect(mockGenerateWorkflowTitle).not.toHaveBeenCalled();
  });

  it('pauses after each step by default and lets Autopilot opt out', async () => {
    render(<WorkflowBuilderView mode={currentMode} session={session} onClose={vi.fn()} />);
    setGoal();

    screen.getByRole('button', { name: 'Autonomy: Ask me' });
    chooseAutonomy('Autopilot');
    screen.getByRole('button', { name: 'Autonomy: Autopilot' });
    fireEvent.click(startBtn());

    await waitFor(() => expect(mockAttach).toHaveBeenCalledOnce());
    expect(mockAttach).toHaveBeenCalledWith(
      'sess-1',
      expect.any(String),
      expect.objectContaining({
        autoRun: true,
        executionMode: 'dynamic',
        rulesSnapshot: expect.objectContaining({ autonomy: 'run' }),
      }),
    );
  });

  it('offers one model control, the orchestrator own, and none per role', () => {
    render(<WorkflowBuilderView mode={currentMode} session={session} onClose={vi.fn()} />);

    expect(screen.getByRole('group', { name: /orchestrator routing/i })).toBeDefined();
    expect(screen.getAllByRole('group', { name: /routing$/i })).toHaveLength(1);
    expect(screen.getByText('Orchestrator')).toBeDefined();
  });

  it('shows the resolved orchestrator model and leaves the run on it by default', async () => {
    render(<WorkflowBuilderView mode={currentMode} session={session} onClose={vi.fn()} />);
    setGoal();

    expect(
      within(orchestratorPicker()).getByRole('button', { name: /^model:auto$/i }).dataset
        .recommendedModel,
    ).toBe('sonnet-5.5');
    fireEvent.click(startBtn());

    await waitFor(() => expect(mockAttach).toHaveBeenCalledOnce());
    expect(mockAttach).toHaveBeenCalledWith(
      'sess-1',
      expect.any(String),
      expect.not.objectContaining({ orchestratorRouting: expect.anything() }),
    );
  });

  it('carries the picked orchestrator model and effort onto the run', async () => {
    render(<WorkflowBuilderView mode={currentMode} session={session} onClose={vi.fn()} />);
    setGoal();

    fireEvent.click(within(orchestratorPicker()).getByRole('button', { name: /^model:auto$/i }));
    fireEvent.click(within(orchestratorPicker()).getByRole('button', { name: /^effort:medium$/i }));
    fireEvent.click(startBtn());

    await waitFor(() => expect(mockAttach).toHaveBeenCalledOnce());
    expect(mockAttach).toHaveBeenCalledWith(
      'sess-1',
      expect.any(String),
      expect.objectContaining({
        executionMode: 'dynamic',
        orchestratorRouting: {
          providerId: 'anthropic',
          model: 'claude-opus-4-6',
          effort: 'high',
        },
      }),
    );
  });

  it('reads the workspace orchestrator task model as the recommendation', async () => {
    storeState.providers = [
      { id: 'anthropic', connection: 'connected' },
      { id: 'codex', connection: 'connected' },
    ];
    storeState.workspaceOverrides = {
      'ws-1': {
        taskModels: {
          workflow_orchestrator: {
            providerId: 'codex',
            model: 'gpt-5.6-sol',
            effort: 'high',
          },
        },
      },
    };
    render(<WorkflowBuilderView mode={currentMode} session={session} onClose={vi.fn()} />);
    setGoal();

    const orchestrator = orchestratorPicker();
    expect(
      within(orchestrator).getByRole('button', { name: /^model:auto$/i }).dataset.recommendedModel,
    ).toBe('gpt-5.6-sol');
    fireEvent.click(within(orchestrator).getByRole('button', { name: /^effort:high$/i }));
    fireEvent.click(startBtn());

    await waitFor(() => expect(mockAttach).toHaveBeenCalledOnce());
    expect(mockAttach).toHaveBeenCalledWith(
      'sess-1',
      expect.any(String),
      expect.objectContaining({
        orchestratorRouting: { providerId: 'codex', model: 'gpt-5.6-sol', effort: 'xhigh' },
      }),
    );
  });

  it('offers only connected providers the orchestrator can run on', () => {
    storeState.providers = [
      { id: 'anthropic', connection: 'connected' },
      { id: 'codex', connection: 'connected' },
      { id: 'gemini', connection: 'disconnected' },
    ];
    render(<WorkflowBuilderView mode={currentMode} session={session} onClose={vi.fn()} />);

    expect(orchestratorPicker().dataset.offeredProviders).toBe('anthropic,codex');
  });

  it('draws only the orchestrator and no likely steps before the run decides them', () => {
    render(<WorkflowBuilderView mode="dynamic" session={session} onClose={vi.fn()} />);

    expect(laneSteps()).toEqual(['orchestrator']);
    expect(screen.queryByText('Likely steps')).toBeNull();
    expect(screen.queryByRole('tablist', { name: /how the steps are set/i })).toBeNull();
  });

  it('keeps guidance behind Add guidance and folds it back when left empty', () => {
    render(<WorkflowBuilderView mode={currentMode} session={session} onClose={vi.fn()} />);
    expect(screen.queryByLabelText('Run guidance')).toBeNull();

    const field = guidanceField();
    expect(document.activeElement).toBe(field);
    fireEvent.blur(field);

    expect(screen.queryByLabelText('Run guidance')).toBeNull();
    expect(screen.getByRole('button', { name: /^add guidance/i })).toBeDefined();
  });

  it('shows the first two guidance lines with Edit once there is guidance', () => {
    render(<WorkflowBuilderView mode={currentMode} session={session} onClose={vi.fn()} />);
    fireEvent.change(guidanceField(), { target: { value: 'one\ntwo\nthree' } });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    const preview = screen.getByTestId('guidance-preview');
    expect(Array.from(preview.querySelectorAll('p')).map((line) => line.textContent)).toEqual([
      'one',
      'two',
    ]);
    expect(screen.queryByRole('button', { name: /^add guidance/i })).toBeNull();
    fireEvent.click(
      within(screen.getByRole('region', { name: 'Guidance' })).getByRole('button', {
        name: 'Edit',
      }),
    );
    expect((screen.getByLabelText('Run guidance') as HTMLTextAreaElement).value).toBe(
      'one\ntwo\nthree',
    );
    expect(screen.getByText('the orchestrator')).toBeDefined();
  });

  it('lets every connected provider run the agents unless the run narrows them', async () => {
    storeState.providers = [
      { id: 'anthropic', connection: 'connected' },
      { id: 'codex', connection: 'connected' },
    ];
    render(<WorkflowBuilderView mode={currentMode} session={session} onClose={vi.fn()} />);
    setGoal();

    expect(screen.getByRole('button', { name: /^can use: every provider$/i })).toBeDefined();
    fireEvent.click(startBtn());

    await waitFor(() => expect(mockAttach).toHaveBeenCalledOnce());
    expect(mockAttach).toHaveBeenCalledWith(
      'sess-1',
      expect.any(String),
      expect.not.objectContaining({ providerPool: expect.anything() }),
    );
  });

  it('carries the providers the run may use onto the orchestrated run', async () => {
    storeState.providers = [
      { id: 'anthropic', connection: 'connected' },
      { id: 'codex', connection: 'connected' },
    ];
    render(<WorkflowBuilderView mode={currentMode} session={session} onClose={vi.fn()} />);
    setGoal();

    openChip(/^can use:/i);
    const providers = screen.getByRole('group', { name: /^providers$/i });
    fireEvent.click(within(providers).getByRole('button', { name: /claude/i }));

    expect(screen.getByRole('button', { name: /^can use: codex$/i })).toBeDefined();
    fireEvent.click(startBtn());
    await waitFor(() => expect(mockAttach).toHaveBeenCalledOnce());
    expect(mockAttach).toHaveBeenCalledWith(
      'sess-1',
      expect.any(String),
      expect.objectContaining({ executionMode: 'dynamic', providerPool: ['codex'] }),
    );
  });

  it('resets the orchestrator model back to the workspace default', async () => {
    render(<WorkflowBuilderView mode={currentMode} session={session} onClose={vi.fn()} />);
    setGoal();

    fireEvent.click(within(orchestratorPicker()).getByRole('button', { name: /^model:auto$/i }));
    fireEvent.click(within(orchestratorPicker()).getByRole('button', { name: /reset routing/i }));
    fireEvent.click(startBtn());

    await waitFor(() => expect(mockAttach).toHaveBeenCalledOnce());
    expect(mockAttach).toHaveBeenCalledWith(
      'sess-1',
      expect.any(String),
      expect.not.objectContaining({ orchestratorRouting: expect.anything() }),
    );
  });

  it('starts on the next free counter name', async () => {
    storeState.phaseTemplates = {
      'ws-1': [
        presetWorkflow('wf-1', 'Orchestrated workflow'),
        presetWorkflow('wf-2', 'Orchestrated workflow 3'),
      ],
    };
    render(<WorkflowBuilderView mode={currentMode} session={session} onClose={vi.fn()} />);
    setGoal();
    fireEvent.click(startBtn());

    await waitFor(() => expect(mockSavePhaseTemplate).toHaveBeenCalledOnce());
    expect(mockSavePhaseTemplate.mock.calls[0]![0].name).toBe('Orchestrated workflow 2');
  });
});

describe('WorkflowBuilderView (preset)', () => {
  rememberMode({ mode: 'preset' });

  it('starts the picked preset with the goal and no new workflow', async () => {
    storeState.phaseTemplates = { 'ws-1': [presetWorkflow('wf-preset-1', 'Ship It')] };
    const onClose = vi.fn();
    render(<WorkflowBuilderView mode={currentMode} session={session} onClose={onClose} />);
    fireEvent.change(goalField(), { target: { value: 'review only the db layer' } });
    expect(screen.getByText('Pick a preset')).toBeDefined();
    expect(startBtn().disabled).toBe(true);
    expect(screen.getByText('Select a preset to start')).toBeDefined();

    pickPreset(/ship it/i);
    expect(startBtn().disabled).toBe(false);

    fireEvent.click(startBtn());
    await waitFor(() =>
      expect(mockAttach).toHaveBeenCalledWith('sess-1', 'wf-preset-1', {
        autoRun: false,
        navigate: true,
        rulesSnapshot: expect.objectContaining({ autonomy: 'step' }),
        goal: 'review only the db layer',
      }),
    );
    expect(mockSavePhaseTemplate).not.toHaveBeenCalled();
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(toastMock).toHaveBeenCalledWith({ kind: 'success', message: 'Started Ship It.' });
  });

  it('shows one provider mark per step in run order on the preset option', () => {
    storeState.providers = [{ id: 'anthropic', connection: 'connected' }];
    storeState.phaseTemplates = { 'ws-1': [presetWorkflow('wf-preset-1', 'Ship It')] };
    render(<WorkflowBuilderView mode={currentMode} session={session} onClose={vi.fn()} />);

    openChip(/^preset:/i);
    const option = screen.getByRole('option', { name: /ship it/i });
    const marks = [...option.querySelectorAll('[data-step-mark]')].map((mark) =>
      mark.getAttribute('data-step-mark'),
    );
    expect(marks).toEqual(['anthropic', 'anthropic']);
    expect(option.textContent).toMatch(/Step 1 Scout · (?!Auto)/);
    expect(option.textContent).toMatch(/Step 2 Implementer · (?!Auto)/);
    expect(option.textContent).not.toContain('2 steps');
  });

  it('shows the Auto glyph for a step it cannot resolve, and a pinned provider as pinned', () => {
    const base = presetWorkflow('wf-preset-1', 'Ship It');
    storeState.phaseTemplates = {
      'ws-1': [
        {
          ...base,
          steps: base.steps.map((step) =>
            step.role === 'implementer' ? { ...step, providerOverride: 'codex' } : step,
          ),
        },
      ],
    };
    render(<WorkflowBuilderView mode={currentMode} session={session} onClose={vi.fn()} />);

    openChip(/^preset:/i);
    const option = screen.getByRole('option', { name: /ship it/i });
    const marks = [...option.querySelectorAll('[data-step-mark]')].map((mark) =>
      mark.getAttribute('data-step-mark'),
    );
    expect(marks).toEqual(['auto', 'codex']);
    expect(option.textContent).toContain('Step 1 Scout · Auto');
  });

  it('draws the real steps with one model chip each and the pause the autonomy asks for', () => {
    storeState.phaseTemplates = { 'ws-1': [presetWorkflow('wf-preset-1', 'Ship It')] };
    render(<WorkflowBuilderView mode={currentMode} session={session} onClose={vi.fn()} />);
    setGoal();
    pickPreset(/ship it/i);

    const rows = laneSteps();
    expect(rows).toHaveLength(3);
    expect(rows[1]).toBe('pause');
    expect(screen.getAllByRole('button', { name: /^Model for / })).toHaveLength(2);
    expect(screen.getByText('Waits for you to continue')).toBeDefined();
    expect(screen.queryByRole('button', { name: /^add step$/i })).toBeNull();
    expect(screen.queryByRole('switch', { name: /save as preset/i })).toBeNull();
    expect(screen.getByText('preset desc')).toBeDefined();
  });

  it('leaves the landing to attachWorkflowToSession after starting a preset as-is', async () => {
    storeState.phaseTemplates = { 'ws-1': [presetWorkflow('wf-preset-1', 'Ship It')] };
    const onClose = vi.fn();
    render(<WorkflowBuilderView mode={currentMode} session={session} onClose={onClose} />);
    setGoal();
    pickPreset(/ship it/i);
    fireEvent.click(startBtn());
    await waitFor(() => expect(mockAttach).toHaveBeenCalledOnce());
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });

  it('deletes a preset from the picker at once and offers Undo that restores it', async () => {
    const preset = presetWorkflow('wf-preset-1', 'Ship It');
    storeState.phaseTemplates = { 'ws-1': [preset] };
    render(<WorkflowBuilderView mode={currentMode} session={session} onClose={vi.fn()} />);
    setGoal();
    openChip(/^preset:/i);
    fireEvent.click(screen.getByRole('button', { name: 'Delete Ship It' }));

    await waitFor(() => expect(mockDeleteWorkflow).toHaveBeenCalledWith('wf-preset-1', 'ws-1'));
    const toast = toastMock.mock.calls.at(-1)?.[0];
    expect(toast).toMatchObject({ message: 'Deleted Ship It', action: { label: 'Undo' } });
    toast.action.onClick();

    await waitFor(() =>
      expect(mockRestoreWorkflowSnapshot).toHaveBeenCalledWith({
        workspaceId: 'ws-1',
        snapshot: preset,
      }),
    );
  });

  it('discarding the draft never deletes the selected preset', () => {
    storeState.phaseTemplates = { 'ws-1': [presetWorkflow('wf-preset-1', 'Ship It')] };
    render(<WorkflowBuilderView mode={currentMode} session={session} onClose={vi.fn()} />);
    setGoal();
    pickPreset(/ship it/i);
    fireEvent.click(screen.getByRole('button', { name: /^discard$/i }));
    expect(mockDeleteWorkflow).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Preset: Pick a preset' })).toBeDefined();
  });

  it('says there are no presets yet and offers Orchestrate instead', () => {
    const onOrchestrateInstead = vi.fn();
    render(
      <WorkflowBuilderView
        mode="preset"
        session={session}
        onOrchestrateInstead={onOrchestrateInstead}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('No presets in this workspace yet')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /orchestrate instead/i }));
    expect(onOrchestrateInstead).toHaveBeenCalledOnce();
  });

  it('follows the role by default and pins one model from the chip popover', async () => {
    storeState.phaseTemplates = { 'ws-1': [presetWorkflow('wf-preset-1', 'Ship It')] };
    render(<WorkflowBuilderView mode={currentMode} session={session} onClose={vi.fn()} />);
    setGoal();
    pickPreset(/ship it/i);

    const popover = openStepModel('Scout');
    expect(popover.getByTestId('step-follows-role').textContent).toContain(
      'Follows the Scout role',
    );
    fireEvent.click(popover.getByRole('tab', { name: 'Pin a model' }));
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Model for Scout' })).getByRole('button', {
        name: /^model:sonnet$/,
      }),
    );

    expect(presetChip().getAttribute('aria-label')).toBe('Preset: Ship It, edited');
    fireEvent.click(startBtn());
    await waitFor(() => expect(mockSavePhaseTemplate).toHaveBeenCalledOnce());
    const saved = mockSavePhaseTemplate.mock.calls[0]![0];
    expect(saved.name).toBe('Ship It 2');
    expect(saved.isPreset).toBe(false);
    expect(saved.steps[0]).toMatchObject({ modelOverride: 'claude-sonnet-4-6', effort: 'high' });
    expect(saved.steps[1]!.modelOverride).toBeUndefined();
    await waitFor(() =>
      expect(mockAttach).toHaveBeenCalledWith('sess-1', saved.id, expect.any(Object)),
    );
  });

  it('flashes the chip when its model changes and resets the preset to its saved steps', () => {
    storeState.phaseTemplates = { 'ws-1': [presetWorkflow('wf-preset-1', 'Ship It')] };
    render(<WorkflowBuilderView mode={currentMode} session={session} onClose={vi.fn()} />);
    setGoal();
    pickPreset(/ship it/i);

    const popover = openStepModel('Scout');
    fireEvent.click(popover.getByRole('tab', { name: 'Pin a model' }));
    expect(stepModelButton('Scout').getAttribute('data-flashing')).toBeNull();
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Model for Scout' })).getByRole('button', {
        name: /^model:sonnet$/,
      }),
    );
    expect(stepModelButton('Scout').getAttribute('data-flashing')).toBe('true');
    expect(presetChip().getAttribute('aria-label')).toBe('Preset: Ship It, edited');

    fireEvent.keyDown(document.body, { key: 'Escape' });
    fireEvent.click(presetChip());
    fireEvent.click(screen.getByRole('button', { name: 'Reset to the preset' }));
    expect(presetChip().getAttribute('aria-label')).toBe('Preset: Ship It');
    expect(screen.queryByText('Edited')).toBeNull();
  });

  it('blocks start on an invalid spend cap with a preset too', () => {
    storeState.phaseTemplates = { 'ws-1': [presetWorkflow('wf-preset-1', 'Ship It')] };
    render(<WorkflowBuilderView mode={currentMode} session={session} onClose={vi.fn()} />);
    setGoal();
    pickPreset(/ship it/i);
    openSpendCap();
    fireEvent.click(screen.getByRole('switch', { name: /^limit$/i }));
    fireEvent.change(screen.getByLabelText('Limit in dollars'), { target: { value: 'x' } });

    expect(startBtn().disabled).toBe(true);
    expect(screen.getByText('Enter a valid limit to start')).toBeDefined();
  });

  it('carries a valid spend cap onto a started preset', async () => {
    storeState.phaseTemplates = { 'ws-1': [presetWorkflow('wf-preset-1', 'Ship It')] };
    render(<WorkflowBuilderView mode={currentMode} session={session} onClose={vi.fn()} />);
    setGoal();
    pickPreset(/ship it/i);
    openSpendCap();
    fireEvent.click(screen.getByRole('switch', { name: /^limit$/i }));
    fireEvent.change(screen.getByLabelText('Limit in dollars'), { target: { value: '9' } });
    fireEvent.click(startBtn());

    await waitFor(() => expect(mockAttach).toHaveBeenCalledOnce());
    expect(mockAttach).toHaveBeenCalledWith(
      'sess-1',
      'wf-preset-1',
      expect.objectContaining({ spendLimitUsd: 9 }),
    );
  });
});

describe('WorkflowBuilderView (starts)', () => {
  it('queues the run as manual when "start manually" is picked', async () => {
    render(<WorkflowBuilderView mode={currentMode} session={session} onClose={vi.fn()} />);
    setGoal();
    openChip(/^starts:/i);
    fireEvent.click(screen.getByRole('radio', { name: /^manually/i }));
    fireEvent.click(startBtn());
    await waitFor(() =>
      expect(mockAttach).toHaveBeenCalledWith(
        'sess-1',
        expect.any(String),
        expect.objectContaining({ triggerMode: 'manual' }),
      ),
    );
  });

  it('hides the run-after option when the session has no active runs', () => {
    render(<WorkflowBuilderView mode={currentMode} session={session} onClose={vi.fn()} />);
    openChip(/^starts:/i);
    expect(screen.queryByRole('radio', { name: /^after /i })).toBeNull();
  });

  it('chains behind an active predecessor when "run after" is picked', async () => {
    storeState.phaseTemplates = {
      'ws-1': [presetWorkflow('wf-prev', 'Scout First'), presetWorkflow('wf-next', 'Ship It')],
    };
    const chainedSession = {
      ...session,
      workflowRuns: [
        {
          id: 'run-prev',
          workflowId: 'wf-prev',
          ordinal: 0,
          currentStep: 0,
          autoRun: false,
          triggerMode: 'immediate',
        },
      ],
    } as unknown as Session;
    render(<WorkflowBuilderView mode="preset" session={chainedSession} onClose={vi.fn()} />);
    setGoal();
    pickPreset(/ship it/i);
    openChip(/^starts:/i);
    fireEvent.click(screen.getByRole('radio', { name: /^after scout first/i }));
    fireEvent.click(startBtn());
    await waitFor(() =>
      expect(mockAttach).toHaveBeenCalledWith('sess-1', 'wf-next', {
        autoRun: false,
        navigate: true,
        rulesSnapshot: expect.objectContaining({ autonomy: 'step' }),
        goal: 'test goal',
        triggerMode: 'after_run',
        chainAfterId: 'run-prev',
      }),
    );
  });
});

describe('WorkflowBuilderView (goal affordances)', () => {
  it('inserts the session goal on click and undoes it', () => {
    render(<WorkflowBuilderView mode={currentMode} session={session} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /use the session goal/i }));
    expect(goalField().value).toBe('do a thing');
    fireEvent.click(screen.getByRole('button', { name: /undo goal change/i }));
    expect(goalField().value).toBe('');
  });

  it('polishes the goal and restores the hand-written text on undo', async () => {
    mockPolish.mockResolvedValue('Polished goal.');
    render(<WorkflowBuilderView mode={currentMode} session={session} onClose={vi.fn()} />);
    fireEvent.change(goalField(), { target: { value: 'rough goal' } });
    fireEvent.click(screen.getByRole('button', { name: /polish goal/i }));
    await waitFor(() => expect(goalField().value).toBe('Polished goal.'));
    fireEvent.click(screen.getByRole('button', { name: /undo goal change/i }));
    expect(goalField().value).toBe('rough goal');
  });

  it('uses the prose polish task model override', async () => {
    storeState.providers = [{ id: 'anthropic', connection: 'connected' }];
    storeState.workspaceOverrides = {
      'ws-1': {
        taskModels: {
          prose_polish: {
            providerId: 'anthropic',
            model: 'claude-sonnet-4-6',
            effort: 'high',
          },
        },
      },
    };
    mockPolish.mockResolvedValue('Polished goal.');
    render(<WorkflowBuilderView mode={currentMode} session={session} onClose={vi.fn()} />);
    fireEvent.change(goalField(), { target: { value: 'rough goal' } });
    fireEvent.click(screen.getByRole('button', { name: /polish goal/i }));

    await waitFor(() =>
      expect(mockPolish).toHaveBeenCalledWith(
        expect.objectContaining({ providerId: 'anthropic', model: 'sonnet-4.6', effort: 'high' }),
        'rough goal',
      ),
    );
  });

  it('keeps the wording and toasts when polish returns nothing', async () => {
    mockPolish.mockResolvedValue(null);
    render(<WorkflowBuilderView mode={currentMode} session={session} onClose={vi.fn()} />);
    fireEvent.change(goalField(), { target: { value: 'rough goal' } });
    fireEvent.click(screen.getByRole('button', { name: /polish goal/i }));
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith({
        kind: 'warning',
        message: "Kept your wording. Couldn't polish the goal.",
      }),
    );
    expect(goalField().value).toBe('rough goal');
    expect(screen.queryByRole('button', { name: /undo goal change/i })).toBeNull();
  });

  it('keeps the attach note behind the paperclip, not on the goal', () => {
    render(<WorkflowBuilderView mode={currentMode} session={session} onClose={vi.fn()} />);
    expect(screen.queryByText('Files go to the agents of this run')).toBeNull();
    expect(screen.getByRole('button', { name: 'Attach files' })).toBeDefined();
  });
});

describe('WorkflowBuilderView (draft persistence)', () => {
  it('rehydrates the draft after unmount and remount for the same session', () => {
    const { unmount } = render(
      <WorkflowBuilderView mode={currentMode} session={session} onClose={vi.fn()} />,
    );
    fireEvent.change(goalField(), { target: { value: 'persist me' } });
    expect(storeState.workflowDrafts['sess-1']?.goalText).toBe('persist me');
    unmount();
    render(<WorkflowBuilderView mode={currentMode} session={session} onClose={vi.fn()} />);
    expect(goalField().value).toBe('persist me');
  });

  it('keeps drafts isolated per session', () => {
    const { unmount } = render(
      <WorkflowBuilderView mode={currentMode} session={session} onClose={vi.fn()} />,
    );
    fireEvent.change(goalField(), { target: { value: 'session one draft' } });
    unmount();
    const otherSession = { ...session, id: 'sess-2' } as Session;
    render(<WorkflowBuilderView mode={currentMode} session={otherSession} onClose={vi.fn()} />);
    expect(goalField().value).toBe('');
    expect(storeState.workflowDrafts['sess-2']).toBeUndefined();
  });

  it('discard changes wipes local state and the stored draft', () => {
    render(<WorkflowBuilderView mode={currentMode} session={session} onClose={vi.fn()} />);
    fireEvent.change(goalField(), { target: { value: 'throwaway' } });
    expect(storeState.workflowDrafts['sess-1']).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /^discard$/i }));
    expect(goalField().value).toBe('');
    expect(storeState.workflowDrafts['sess-1']).toBeUndefined();
  });

  it('hides the discard action while the draft is empty', () => {
    render(<WorkflowBuilderView mode={currentMode} session={session} onClose={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /^discard$/i })).toBeNull();
    fireEvent.change(goalField(), { target: { value: 'now dirty' } });
    expect(screen.getByRole('button', { name: /^discard$/i })).toBeDefined();
  });

  it('clears the draft after attaching a workflow', async () => {
    render(<WorkflowBuilderView mode={currentMode} session={session} onClose={vi.fn()} />);
    setGoal();
    expect(storeState.workflowDrafts['sess-1']).toBeDefined();
    fireEvent.click(startBtn());
    await waitFor(() => expect(mockAttach).toHaveBeenCalled());
    await waitFor(() => expect(storeState.workflowDrafts['sess-1']).toBeUndefined());
  });

  it('keeps the draft when the surface around it unmounts without a start', () => {
    const { unmount } = render(
      <WorkflowBuilderView mode={currentMode} session={session} onClose={vi.fn()} />,
    );
    fireEvent.change(goalField(), { target: { value: 'keep me' } });
    unmount();
    expect(storeState.workflowDrafts['sess-1']?.goalText).toBe('keep me');
  });
});

describe('WorkflowBuilderView (docked in a drawer)', () => {
  const mountDock = () => {
    const dock = document.createElement('div');
    document.body.append(dock);
    return dock;
  };

  it('puts the options, Discard and the primary in one row in the dock', () => {
    const dock = mountDock();
    render(
      <WorkflowBuilderView
        mode="dynamic"
        session={session}
        slots={{ actionsHost: dock }}
        onClose={vi.fn()}
      />,
    );

    expect(within(dock).getByRole('button', { name: 'Start orchestration' })).toBeDefined();
    expect(within(dock).getByRole('button', { name: /^autonomy:/i })).toBeDefined();
    expect(within(dock).getByRole('button', { name: /^starts:/i })).toBeDefined();
    expect(within(dock).getByRole('button', { name: /^limit:/i })).toBeDefined();
    expect(within(dock).queryByRole('button', { name: /^discard$/i })).toBeNull();

    fireEvent.change(goalField(), { target: { value: 'now dirty' } });
    fireEvent.click(within(dock).getByRole('button', { name: /^discard$/i }));
    expect(goalField().value).toBe('');
    expect(within(dock).queryByRole('button', { name: /^discard$/i })).toBeNull();
  });

  it('renders nothing until the dock node exists', () => {
    render(
      <WorkflowBuilderView
        mode="dynamic"
        session={session}
        slots={{ actionsHost: null }}
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: /start run/i })).toBeNull();
    expect(goalField()).toBeDefined();
  });
});

describe('WorkflowBuilderView (suggested title)', () => {
  const suggestFromGoal = async (suggestion: string) => {
    mockSuggestTitle.mockResolvedValue(suggestion);
    fireEvent.change(goalField(), { target: { value: 'move checkout to server actions' } });
    fireEvent.blur(goalField());
    await waitFor(() => expect(mockSuggestTitle).toHaveBeenCalled());
  };

  it('starts on the suggested title, without a second title pass', async () => {
    render(<WorkflowBuilderView mode={currentMode} session={session} onClose={vi.fn()} />);
    await suggestFromGoal('Move checkout to server actions');

    fireEvent.click(startBtn());

    await waitFor(() => expect(mockSavePhaseTemplate).toHaveBeenCalledOnce());
    expect(mockSavePhaseTemplate.mock.calls[0]![0].name).toBe('Move checkout to server actions');
    expect(mockGenerateWorkflowTitle).not.toHaveBeenCalled();
  });

  it('asks once per goal', async () => {
    render(<WorkflowBuilderView mode={currentMode} session={session} onClose={vi.fn()} />);
    await suggestFromGoal('Move checkout to server actions');
    fireEvent.blur(goalField());
    expect(mockSuggestTitle).toHaveBeenCalledOnce();
  });
});

type KickoffHarnessProps = {
  readonly start: BuilderKickoff['start'];
  readonly startError?: string | null;
  readonly mode?: Mode;
};

const KickoffHarness = ({ start, startError = null, mode = 'dynamic' }: KickoffHarnessProps) => {
  const [goal, setGoal] = useState('');
  return (
    <WorkflowBuilderView
      mode={mode}
      kickoff={{
        workspaceId: session.workspaceId,
        goal,
        goalPlaceholder: 'What should get done?',
        onGoalChange: setGoal,
        startError,
        start,
      }}
    />
  );
};

const createdSession = { ...session, id: 'sess-new' } as Session;

const kickoffStart = () =>
  vi.fn(async (run: (target: Session) => Promise<void>) => {
    await run(createdSession);
  });

const kickoffGoal = () =>
  screen.getByPlaceholderText('What should get done?') as HTMLTextAreaElement;

describe('WorkflowBuilderView (kickoff, before the session exists)', () => {
  it('shows the start error the store kept, and Start stays pressable to retry', () => {
    storeState.providers = [{ id: 'anthropic', connection: 'connected' }];
    const start = kickoffStart();
    render(<KickoffHarness start={start} startError="workflow not found: wf_builder_missing" />);
    fireEvent.change(kickoffGoal(), { target: { value: 'Speed up the ledger export' } });

    expect(screen.getByRole('alert').textContent).toContain('workflow not found');
    expect(startBtn().disabled).toBe(false);
  });

  it('shows the orchestrate lane, guidance and the launch controls, and no Can use with one provider', () => {
    storeState.providers = [{ id: 'anthropic', connection: 'connected' }];
    render(<KickoffHarness start={kickoffStart()} />);

    expect(orchestratorPicker()).toBeDefined();
    expect(screen.getByRole('button', { name: /^add guidance/i })).toBeDefined();
    expect(screen.queryByText('Can use')).toBeNull();
    expect(screen.getByText('Set a goal to start')).toBeDefined();
    expect(startBtn().disabled).toBe(true);
  });

  it('offers Can use only the providers the workspace policy does not turn off', () => {
    storeState.providers = [
      { id: 'anthropic', connection: 'connected' },
      { id: 'codex', connection: 'connected' },
      { id: 'cursor', connection: 'connected' },
    ];
    storeState.workspaceOverrides = {
      'ws-1': {
        providerPool: [
          { id: 'cursor', state: 'on' },
          { id: 'codex', state: 'off' },
          { id: 'anthropic', state: 'backup' },
        ],
      },
    };
    render(<KickoffHarness start={kickoffStart()} />);

    fireEvent.click(screen.getByRole('button', { name: /Can use/ }));

    const offered = within(
      screen.getByRole('dialog', { name: 'Providers this run can use' }),
    ).getAllByRole('button');
    expect(offered.map((button) => button.textContent)).toEqual(['Cursor', 'Claude']);
  });

  it('has one goal field and nothing that needs a session', () => {
    render(<KickoffHarness start={kickoffStart()} />);

    expect(screen.getAllByRole('textbox', { name: 'Goal' })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /use the session goal/i })).toBeNull();
  });

  it('offers the preset picker when the workspace has presets', () => {
    storeState.phaseTemplates = { 'ws-1': [presetWorkflow('wf-1', 'Plan and ship')] };
    render(<KickoffHarness start={kickoffStart()} mode="preset" />);

    expect(screen.getByText('Pick a preset')).toBeDefined();
    expect(screen.queryByText('No presets in this workspace yet')).toBeNull();
  });

  it('keeps its draft under the workspace kickoff, not a session', () => {
    render(<KickoffHarness start={kickoffStart()} />);
    fireEvent.change(kickoffGoal(), { target: { value: 'test goal' } });
    fireEvent.click(screen.getByRole('button', { name: /autonomy/i }));
    fireEvent.click(screen.getByRole('radio', { name: /^Autopilot/ }));

    expect(storeState.workflowDrafts['kickoff:ws-1']?.mode).toBe('dynamic');
    expect(storeState.workflowDrafts['sess-1']).toBeUndefined();
  });

  it('creates the session, then starts the orchestrated run on it, in one action', async () => {
    const start = kickoffStart();
    render(<KickoffHarness start={start} />);
    fireEvent.change(kickoffGoal(), { target: { value: 'test goal' } });
    fireEvent.click(startBtn());

    await waitFor(() => expect(mockAttach).toHaveBeenCalledOnce());
    expect(start).toHaveBeenCalledOnce();
    expect(mockSavePhaseTemplate.mock.calls[0]![0]).toEqual(
      expect.objectContaining({ workspaceId: 'ws-1', origin: 'orchestrated' }),
    );
    expect(mockAttach).toHaveBeenCalledWith(
      'sess-new',
      expect.any(String),
      expect.objectContaining({ goal: 'test goal', executionMode: 'dynamic', navigate: true }),
    );
  });

  it('shows why inline when the session could not be created', async () => {
    const start = vi.fn(async () => {
      throw new Error('provider offline');
    });
    render(<KickoffHarness start={start} />);
    fireEvent.change(kickoffGoal(), { target: { value: 'test goal' } });
    fireEvent.click(startBtn());

    expect((await screen.findByRole('alert')).textContent).toContain('provider offline');
    expect(mockAttach).not.toHaveBeenCalled();
    expect(kickoffGoal().value).toBe('test goal');
  });
});
