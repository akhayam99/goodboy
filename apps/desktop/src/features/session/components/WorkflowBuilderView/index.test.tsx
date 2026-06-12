// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Session, Workflow } from '@goodboy/types';

const { mockSavePhaseTemplate, mockAttach, mockPlan, mockPolish, toastMock, storeState } =
  vi.hoisted(() => ({
    mockSavePhaseTemplate: vi.fn(async (_workflow: Workflow) => undefined),
    mockAttach: vi.fn(async () => undefined),
    mockPlan: vi.fn(),
    mockPolish: vi.fn(),
    toastMock: vi.fn(),
    storeState: { phaseTemplates: {} as Record<string, ReadonlyArray<Workflow>> },
  }));

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => undefined) }));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  useAppStore: <T,>(selector: (s: never) => T) =>
    selector({
      savePhaseTemplate: mockSavePhaseTemplate,
      attachWorkflowToSession: mockAttach,
      phaseTemplates: storeState.phaseTemplates,
    } as never),
}));

vi.mock('../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast: toastMock }),
}));

vi.mock('@goodboy/core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@goodboy/core')>();
  return {
    ...original,
    PlannerClient: vi.fn().mockImplementation(() => ({ plan: mockPlan })),
    polishWorkflowGoal: mockPolish,
  };
});

vi.mock('../ModelSelect', () => ({
  ModelSelect: ({ value, onChange }: { value: string; onChange: (model: string) => void }) => (
    <button type="button" onClick={() => onChange('claude-opus-4-6')}>
      model:{value === '' ? 'auto' : value}
    </button>
  ),
}));

import { WorkflowBuilderView } from './index';

const session: Session = {
  id: 'sess-1',
  workspaceId: 'ws-1',
  goal: 'do a thing',
  providerPreference: { defaultProvider: 'anthropic' },
} as unknown as Session;

const PLAN_FIXTURE = {
  workflowName: 'Test Workflow',
  reasoning: 'test reasoning',
  steps: [
    { name: 'scout', role: 'scout', promptPrefix: 'scout prefix', expectedOutput: 'scout output' },
    {
      name: 'implementer',
      role: 'engineer',
      promptPrefix: 'eng prefix',
      expectedOutput: 'eng output',
    },
  ],
};

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
});

const goalField = () =>
  screen.getByPlaceholderText(/what should this workflow accomplish/i) as HTMLTextAreaElement;

async function draftPlan() {
  mockPlan.mockResolvedValue({ output: PLAN_FIXTURE });
  fireEvent.change(screen.getByPlaceholderText(/describe the process/i), {
    target: { value: 'do something' },
  });
  fireEvent.click(screen.getByRole('button', { name: /generate plan/i }));
  await waitFor(() => screen.getByText('Workflow ready'));
}

describe('WorkflowBuilderView (custom mode, no presets)', () => {
  it('enables start only after a plan is drafted', async () => {
    render(<WorkflowBuilderView session={session} onClose={vi.fn()} />);
    const start = screen.getByRole('button', { name: /start workflow/i }) as HTMLButtonElement;
    expect(start.disabled).toBe(true);
    await draftPlan();
    expect(start.disabled).toBe(false);
    expect(screen.getByRole('button', { name: /re-plan/i })).toBeDefined();
  });

  it('persists with auto steps (modelOverride undefined) and attaches on start', async () => {
    const onClose = vi.fn();
    render(<WorkflowBuilderView session={session} onClose={onClose} />);
    await draftPlan();
    fireEvent.click(screen.getByRole('button', { name: /start workflow/i }));
    await waitFor(() => expect(mockSavePhaseTemplate).toHaveBeenCalledOnce());
    const saved = mockSavePhaseTemplate.mock.calls[0]![0];
    expect(saved.isPreset).toBe(false);
    expect(saved.name).toBe('Test Workflow');
    expect(saved.steps.map((s) => s.role)).toEqual(['scout', 'engineer']);
    expect(saved.steps.map((s) => s.ordinal)).toEqual([0, 1]);
    expect(saved.steps.every((s) => s.modelOverride === undefined)).toBe(true);
    expect(saved.steps.every((s) => s.workflowId === saved.id)).toBe(true);
    await waitFor(() =>
      expect(mockAttach).toHaveBeenCalledWith('sess-1', saved.id, { autoRun: false }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(toastMock).toHaveBeenCalledWith('success', 'workflow started: Test Workflow');
  });

  it('passes the typed goal per-run and onto the saved template', async () => {
    render(<WorkflowBuilderView session={session} onClose={vi.fn()} />);
    fireEvent.change(goalField(), { target: { value: 'just the auth module' } });
    await draftPlan();
    fireEvent.click(screen.getByRole('button', { name: /start workflow/i }));
    await waitFor(() => expect(mockSavePhaseTemplate).toHaveBeenCalledOnce());
    expect(mockSavePhaseTemplate.mock.calls[0]![0].goal).toBe('just the auth module');
    await waitFor(() =>
      expect(mockAttach).toHaveBeenCalledWith('sess-1', expect.any(String), {
        autoRun: false,
        goal: 'just the auth module',
      }),
    );
  });

  it('lands an explicit model pick in modelOverride for that step only', async () => {
    render(<WorkflowBuilderView session={session} onClose={vi.fn()} />);
    await draftPlan();
    fireEvent.click(screen.getAllByRole('button', { name: /^model:auto$/i })[0]!);
    fireEvent.click(screen.getByRole('button', { name: /start workflow/i }));
    await waitFor(() => expect(mockSavePhaseTemplate).toHaveBeenCalledOnce());
    const saved = mockSavePhaseTemplate.mock.calls[0]![0];
    expect(saved.steps[0]!.modelOverride).toBe('claude-opus-4-6');
    expect(saved.steps[1]!.modelOverride).toBeUndefined();
  });

  it('respects the preset and auto-run toggles', async () => {
    render(<WorkflowBuilderView session={session} onClose={vi.fn()} />);
    await draftPlan();
    fireEvent.click(screen.getByRole('switch', { name: /save as preset/i }));
    fireEvent.click(screen.getByRole('switch', { name: /auto-run/i }));
    fireEvent.click(screen.getByRole('button', { name: /start workflow/i }));
    await waitFor(() => expect(mockSavePhaseTemplate).toHaveBeenCalledOnce());
    expect(mockSavePhaseTemplate.mock.calls[0]![0].isPreset).toBe(true);
    await waitFor(() =>
      expect(mockAttach).toHaveBeenCalledWith('sess-1', expect.any(String), { autoRun: true }),
    );
  });

  it('re-design clears the ladder and disables start again', async () => {
    render(<WorkflowBuilderView session={session} onClose={vi.fn()} />);
    await draftPlan();
    fireEvent.click(screen.getByRole('button', { name: /re-design/i }));
    expect(screen.queryByText('Workflow ready')).toBeNull();
    expect(screen.getByText('Step preview')).toBeDefined();
    const start = screen.getByRole('button', { name: /start workflow/i }) as HTMLButtonElement;
    expect(start.disabled).toBe(true);
  });

  it('shows a plan error and keeps start disabled when planning fails', async () => {
    mockPlan.mockRejectedValue(new Error('model unavailable'));
    render(<WorkflowBuilderView session={session} onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/describe the process/i), {
      target: { value: 'fail case' },
    });
    fireEvent.click(screen.getByRole('button', { name: /generate plan/i }));
    await waitFor(() => screen.getByRole('alert'));
    expect(screen.getByRole('alert').textContent).toMatch(/model unavailable/i);
    expect(mockSavePhaseTemplate).not.toHaveBeenCalled();
    const start = screen.getByRole('button', { name: /start workflow/i }) as HTMLButtonElement;
    expect(start.disabled).toBe(true);
  });

  it('cancels via the footer button', () => {
    const onClose = vi.fn();
    render(<WorkflowBuilderView session={session} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe('WorkflowBuilderView (preset mode)', () => {
  it('defaults to preset mode when presets exist and starts the picked preset with the goal', async () => {
    storeState.phaseTemplates = { 'ws-1': [presetWorkflow('wf-preset-1', 'Ship It')] };
    const onClose = vi.fn();
    render(<WorkflowBuilderView session={session} onClose={onClose} />);
    expect(screen.getByText(/pick the preset/i)).toBeDefined();
    const start = screen.getByRole('button', { name: /start workflow/i }) as HTMLButtonElement;
    expect(start.disabled).toBe(true);

    fireEvent.change(goalField(), { target: { value: 'review only the db layer' } });
    fireEvent.click(screen.getByRole('radio', { name: /ship it/i }));
    expect(start.disabled).toBe(false);

    fireEvent.click(start);
    await waitFor(() =>
      expect(mockAttach).toHaveBeenCalledWith('sess-1', 'wf-preset-1', {
        autoRun: false,
        goal: 'review only the db layer',
      }),
    );
    expect(mockSavePhaseTemplate).not.toHaveBeenCalled();
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(toastMock).toHaveBeenCalledWith('success', 'workflow started: Ship It');
  });

  it('switches to custom mode via the segment', () => {
    storeState.phaseTemplates = { 'ws-1': [presetWorkflow('wf-preset-1', 'Ship It')] };
    render(<WorkflowBuilderView session={session} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /custom/i }));
    expect(screen.getByPlaceholderText(/describe the process/i)).toBeDefined();
  });
});

describe('WorkflowBuilderView (goal affordances)', () => {
  it('inserts the session goal on click and undoes it', () => {
    render(<WorkflowBuilderView session={session} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /use session goal/i }));
    expect(goalField().value).toBe('do a thing');
    fireEvent.click(screen.getByRole('button', { name: /undo goal change/i }));
    expect(goalField().value).toBe('');
  });

  it('polishes the goal and restores the hand-written text on undo', async () => {
    mockPolish.mockResolvedValue('Polished goal.');
    render(<WorkflowBuilderView session={session} onClose={vi.fn()} />);
    fireEvent.change(goalField(), { target: { value: 'rough goal' } });
    fireEvent.click(screen.getByRole('button', { name: /polish goal/i }));
    await waitFor(() => expect(goalField().value).toBe('Polished goal.'));
    fireEvent.click(screen.getByRole('button', { name: /undo goal change/i }));
    expect(goalField().value).toBe('rough goal');
  });

  it('keeps the wording and toasts when polish returns nothing', async () => {
    mockPolish.mockResolvedValue(null);
    render(<WorkflowBuilderView session={session} onClose={vi.fn()} />);
    fireEvent.change(goalField(), { target: { value: 'rough goal' } });
    fireEvent.click(screen.getByRole('button', { name: /polish goal/i }));
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        'error',
        'could not polish the goal, kept your wording',
      ),
    );
    expect(goalField().value).toBe('rough goal');
    expect(screen.queryByRole('button', { name: /undo goal change/i })).toBeNull();
  });
});
