// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

const { state } = vi.hoisted(() => ({
  state: {
    phaseTemplates: {} as Record<string, ReadonlyArray<unknown>>,
    stepLibrary: {} as Record<string, ReadonlyArray<unknown>>,
    providers: [] as ReadonlyArray<unknown>,
    workspaces: [] as ReadonlyArray<unknown>,
    workflowStudioDrafts: {} as Record<string, unknown>,
    workflowGenerations: {} as Record<string, unknown>,
    loadPhaseTemplates: vi.fn(async () => undefined),
    loadStepLibrary: vi.fn(async () => undefined),
    savePhaseTemplate: vi.fn(async (_input: unknown): Promise<unknown> => undefined),
    deleteWorkflow: vi.fn(async () => undefined),
    saveStepDef: vi.fn(async () => undefined),
    deleteStepDef: vi.fn(async () => undefined),
    resetWorkflows: vi.fn(async () => undefined),
    setWorkflowStudioDraft: vi.fn(),
    clearWorkflowStudioDraft: vi.fn(),
    startWorkflowGeneration: vi.fn(async () => true),
    consumeWorkflowGeneration: vi.fn(),
  },
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => undefined) }));

vi.mock('@goodboy/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@goodboy/core')>();
  return { ...actual, formatWorkflowFromNL: vi.fn(async () => null) };
});

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: [] as readonly never[],
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

import { ToastProvider } from '../../../../app/components/Toast';
import { WorkflowsPanel } from './index';

const renderPanel = () =>
  render(
    <ToastProvider>
      <WorkflowsPanel workspaceId={'ws-1' as never} />
    </ToastProvider>,
  );

beforeEach(() => {
  state.phaseTemplates = {};
  state.stepLibrary = {};
  state.providers = [];
  state.workspaces = [];
  state.workflowStudioDrafts = {};
  state.workflowGenerations = {};
  state.loadPhaseTemplates = vi.fn(async () => undefined);
  state.loadStepLibrary = vi.fn(async () => undefined);
  state.savePhaseTemplate = vi.fn(async (_input: unknown): Promise<unknown> => undefined);
  state.deleteWorkflow = vi.fn(async () => undefined);
  state.saveStepDef = vi.fn(async () => undefined);
  state.deleteStepDef = vi.fn(async () => undefined);
  state.resetWorkflows = vi.fn(async () => undefined);
});
afterEach(cleanup);

const makeWorkflow = (overrides: Record<string, unknown> = {}) => ({
  id: 'wf-1',
  workspaceId: 'ws-1',
  name: 'My workflow',
  description: '',
  steps: [],
  isPreset: true,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  ...overrides,
});

describe('WorkflowsPanel', () => {
  it('renders the empty-state copy when no workflows exist', () => {
    renderPanel();
    expect(screen.getByText(/no presets yet/i)).toBeDefined();
  });

  it('renders a New workflow button', () => {
    renderPanel();
    expect(screen.getByRole('button', { name: /new workflow/i })).toBeDefined();
  });

  it('loads phase templates and step library on mount', () => {
    renderPanel();
    expect(state.loadPhaseTemplates).toHaveBeenCalledWith('ws-1');
    expect(state.loadStepLibrary).toHaveBeenCalledWith('ws-1');
  });

  it('renders preset workflow names when they exist', () => {
    state.phaseTemplates = { 'ws-1': [makeWorkflow({ name: 'Plan and build' })] };
    renderPanel();
    expect(screen.getByText('Plan and build')).toBeDefined();
  });

  it('hides soft-deleted (deletedAt) workflows from the preset list', () => {
    state.phaseTemplates = {
      'ws-1': [
        makeWorkflow({ name: 'Visible workflow' }),
        makeWorkflow({
          id: 'wf-2',
          name: 'Deleted workflow',
          deletedAt: '2024-06-01T00:00:00.000Z',
        }),
      ],
    };
    renderPanel();
    expect(screen.getByText('Visible workflow')).toBeDefined();
    expect(screen.queryByText('Deleted workflow')).toBeNull();
  });

  it('keeps a workflow the user declined to save out of the preset rail', () => {
    state.phaseTemplates = {
      'ws-1': [
        makeWorkflow({ name: 'Approved preset' }),
        makeWorkflow({ id: 'wf-3', name: 'Draft workflow', isPreset: false }),
      ],
    };
    renderPanel();
    expect(screen.getByText('Approved preset')).toBeDefined();
    expect(screen.queryByText('Draft workflow')).toBeNull();
  });

  it('shows empty state when every template is soft-deleted', () => {
    state.phaseTemplates = {
      'ws-1': [
        makeWorkflow({ id: 'wf-d', name: 'Gone', deletedAt: '2024-01-01T00:00:00.000Z' }),
        makeWorkflow({ id: 'wf-d2', name: 'Also gone', deletedAt: '2024-01-02T00:00:00.000Z' }),
      ],
    };
    renderPanel();
    expect(screen.getByText(/no presets yet/i)).toBeDefined();
  });

  it('duplicates a workflow as an independent preset', async () => {
    const original = makeWorkflow({
      name: 'Plan and build',
      steps: [
        {
          id: 'step-1',
          role: 'planner',
          ordinal: 0,
          name: 'Plan',
          promptPrefix: 'Write the plan',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ],
    });
    state.phaseTemplates = { 'ws-1': [original] };
    state.savePhaseTemplate = vi.fn(async (input: unknown) => ({
      ...original,
      ...(input as Record<string, unknown>),
      id: 'wf-copy',
      steps: [],
    }));
    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: /Plan and build/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }));

    await waitFor(() => expect(state.savePhaseTemplate).toHaveBeenCalledOnce());
    const input = state.savePhaseTemplate.mock.calls[0]?.[0];
    expect(input).not.toHaveProperty('id');
    expect(input).toMatchObject({ name: 'Plan and build copy', isPreset: true });
  });

  it('restores an unnamed local draft and reset clears it', () => {
    state.workflowStudioDrafts = {
      'ws-1': {
        workflowId: null,
        agentPrompt: '',
        form: {
          name: '',
          description: 'Half typed description',
          goal: '',
          steps: [
            {
              uid: 'draft-step',
              role: 'custom',
              name: '',
              promptPrefix: '',
              expectedOutput: '',
              providerOverride: '',
              modelOverride: '',
              effort: 'medium',
              verbosity: 'normal',
            },
          ],
        },
      },
    };
    renderPanel();

    const description = screen.getByRole('textbox', {
      name: 'Workflow description',
    }) as HTMLInputElement;
    expect(description.value).toBe('Half typed description');
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Discard local changes?' })).getByRole('button', {
        name: 'Reset',
      }),
    );

    expect(state.clearWorkflowStudioDraft).toHaveBeenCalledWith({ workspaceId: 'ws-1' });
    expect(screen.getByRole('heading', { name: 'Build a workflow' })).toBeDefined();
  });

  it('flushes a restored draft with unsaved edits without a further edit', async () => {
    const original = makeWorkflow({
      name: 'Plan and build',
      steps: [
        {
          id: 'step-1',
          role: 'planner',
          ordinal: 0,
          name: 'Plan',
          promptPrefix: 'Write the plan',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ],
    });
    state.phaseTemplates = { 'ws-1': [original] };
    state.workflowStudioDrafts = {
      'ws-1': {
        workflowId: 'wf-1',
        agentPrompt: '',
        form: {
          name: 'Plan and build, revised',
          description: '',
          goal: '',
          steps: [
            {
              uid: 'draft-step',
              id: 'step-1',
              role: 'planner',
              name: 'Plan',
              promptPrefix: 'Write the plan',
              expectedOutput: '',
              providerOverride: '',
              modelOverride: '',
              effort: 'medium',
              verbosity: 'normal',
            },
          ],
        },
      },
    };
    state.savePhaseTemplate = vi.fn(async (input: unknown) => ({
      ...original,
      ...(input as Record<string, unknown>),
    }));
    renderPanel();

    const name = screen.getByRole('textbox', { name: 'Workflow name' }) as HTMLInputElement;
    expect(name.value).toBe('Plan and build, revised');

    await waitFor(() => expect(state.savePhaseTemplate).toHaveBeenCalledOnce(), {
      timeout: 2_000,
    });
    const input = state.savePhaseTemplate.mock.calls[0]?.[0];
    expect(input).toMatchObject({ name: 'Plan and build, revised' });
  });

  it('never reports saved while an autosave write is outstanding', async () => {
    let finishSave: (workflow: unknown) => void = vi.fn();
    state.phaseTemplates = { 'ws-1': [makeWorkflow({ name: 'Plan and build' })] };
    state.savePhaseTemplate = vi.fn(
      async () =>
        await new Promise<unknown>((resolve) => {
          finishSave = resolve;
        }),
    );
    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: /Plan and build/ }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Workflow name' }), {
      target: { value: 'Plan, build, review' },
    });

    await waitFor(() => expect(state.savePhaseTemplate).toHaveBeenCalledOnce(), { timeout: 2_000 });
    expect(screen.queryByText('Saved')).toBeNull();
    expect(screen.getByText('Changes save automatically')).toBeDefined();

    finishSave(makeWorkflow({ name: 'Plan, build, review' }));
  });

  it('keeps an autosave failure visible in the editor header', async () => {
    state.phaseTemplates = { 'ws-1': [makeWorkflow({ name: 'Plan and build' })] };
    state.savePhaseTemplate = vi.fn(async () => {
      throw new Error('disk is read-only');
    });
    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: /Plan and build/ }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Workflow name' }), {
      target: { value: 'Plan, build, review' },
    });

    const alert = await screen.findByRole('alert', {}, { timeout: 2_000 });
    expect(alert.textContent).toContain('disk is read-only');
  });
});
