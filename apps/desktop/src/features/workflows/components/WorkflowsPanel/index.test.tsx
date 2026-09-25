// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

const { invokeMock, state } = vi.hoisted(() => ({
  invokeMock: vi.fn(async (_cmd: string, _args?: unknown): Promise<unknown> => undefined),
  state: {
    phaseTemplates: {} as Record<string, ReadonlyArray<unknown>>,
    stepLibrary: {} as Record<string, ReadonlyArray<unknown>>,
    providers: [] as ReadonlyArray<unknown>,
    projects: [] as ReadonlyArray<unknown>,
    workspaces: [] as ReadonlyArray<unknown>,
    workspaceOverrides: {} as Record<string, unknown>,
    cliRequirements: [] as ReadonlyArray<unknown>,
    workflowStudioDrafts: {} as Record<string, unknown>,
    workflowGenerations: {} as Record<string, unknown>,
    loadPhaseTemplates: vi.fn(async () => undefined),
    loadStepLibrary: vi.fn(async () => undefined),
    copyWorkflowFromWorkspace: vi.fn(async (_input: unknown): Promise<unknown> => undefined),
    savePhaseTemplate: vi.fn(async (_input: unknown): Promise<unknown> => undefined),
    deleteWorkflow: vi.fn(async () => undefined),
    resetWorkflows: vi.fn(async () => undefined),
    setWorkflowStudioDraft: vi.fn(),
    clearWorkflowStudioDraft: vi.fn(),
    startWorkflowGeneration: vi.fn(async (_input: unknown) => true),
    consumeWorkflowGeneration: vi.fn(),
  },
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }));

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
  state.projects = [];
  state.workspaces = [];
  state.workspaceOverrides = {};
  state.workflowStudioDrafts = {};
  state.workflowGenerations = {};
  state.loadPhaseTemplates = vi.fn(async () => undefined);
  state.loadStepLibrary = vi.fn(async () => undefined);
  state.copyWorkflowFromWorkspace = vi.fn(async (_input: unknown): Promise<unknown> => undefined);
  state.savePhaseTemplate = vi.fn(async (_input: unknown): Promise<unknown> => undefined);
  state.deleteWorkflow = vi.fn(async () => undefined);
  state.resetWorkflows = vi.fn(async () => undefined);
  state.setWorkflowStudioDraft = vi.fn();
  state.clearWorkflowStudioDraft = vi.fn();
  state.startWorkflowGeneration = vi.fn(async (_input: unknown) => true);
  state.consumeWorkflowGeneration = vi.fn();
  invokeMock.mockReset();
  invokeMock.mockResolvedValue(undefined);
});
afterEach(cleanup);

const makeWorkflow = (overrides: Record<string, unknown> = {}) => ({
  id: 'wf-1',
  workspaceId: 'ws-1',
  name: 'My workflow',
  description: '',
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
  isPreset: true,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  ...overrides,
});

const draftStep = (overrides: Record<string, unknown> = {}) => ({
  key: 'draft-step',
  sourceStepId: 'step-1',
  libraryStepId: null,
  role: 'planner',
  name: 'Plan',
  prompt: 'Write the plan',
  expectedOutput: '',
  provider: '',
  model: '',
  effort: 'medium',
  verbosity: 'normal',
  size: null,
  ...overrides,
});

const connectProvider = () => {
  state.providers = [{ id: 'anthropic', connection: 'connected' }];
};

const openWorkflow = (name: string) => {
  fireEvent.click(screen.getByRole('button', { name: `Open ${name}` }));
};

const openMenuItem = (name: string) => {
  fireEvent.click(screen.getByRole('button', { name: 'Workflow actions' }));
  fireEvent.click(screen.getByRole('menuitem', { name }));
};

describe('WorkflowsPanel home', () => {
  it('shows one primary, one import and one menu in the header', () => {
    renderPanel();
    expect(screen.getByRole('button', { name: /new workflow/i })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Import' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Workflow actions' })).toBeDefined();
    expect(screen.getByText(/no workflows yet/i)).toBeDefined();
  });

  it('loads phase templates and step library on mount', () => {
    renderPanel();
    expect(state.loadPhaseTemplates).toHaveBeenCalledWith('ws-1');
    expect(state.loadStepLibrary).toHaveBeenCalledWith('ws-1');
  });

  it('lists presets and hides deleted and unsaved workflows', () => {
    state.phaseTemplates = {
      'ws-1': [
        makeWorkflow({ name: 'Visible workflow' }),
        makeWorkflow({ id: 'wf-2', name: 'Deleted workflow', deletedAt: '2024-06-01T00:00:00Z' }),
        makeWorkflow({ id: 'wf-3', name: 'Draft workflow', isPreset: false }),
      ],
    };
    renderPanel();
    expect(screen.getByRole('button', { name: 'Open Visible workflow' })).toBeDefined();
    expect(screen.queryByText('Deleted workflow')).toBeNull();
    expect(screen.queryByText('Draft workflow')).toBeNull();
  });

  it('restores built-in workflows after an inline confirm that names the workspace', async () => {
    state.workspaces = [{ id: 'ws-1', name: 'Harborline' }];
    renderPanel();
    openMenuItem('Restore built-in workflows');
    const confirm = screen.getByRole('group', {
      name: 'Restore built-in workflows in Harborline?',
    });
    fireEvent.click(within(confirm).getByRole('button', { name: 'Restore' }));
    await waitFor(() => expect(state.resetWorkflows).toHaveBeenCalledWith('ws-1'));
  });
});

describe('WorkflowsPanel editor', () => {
  it('opens a workflow in the editor and goes back with the breadcrumb', () => {
    state.phaseTemplates = { 'ws-1': [makeWorkflow({ name: 'Plan and build' })] };
    renderPanel();
    openWorkflow('Plan and build');

    const name = screen.getByRole('textbox', { name: 'Workflow name' }) as HTMLTextAreaElement;
    expect(name.value).toBe('Plan and build');
    expect(screen.getByRole('button', { name: 'Step 1: Plan' })).toBeDefined();
    expect(screen.getByRole('button', { name: /Redraft steps/ })).toBeDefined();

    fireEvent.click(
      within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getByRole('button', {
        name: 'Workflows',
      }),
    );
    expect(screen.getByRole('button', { name: 'Open Plan and build' })).toBeDefined();
  });

  it('starts a new workflow on an empty plan with Draft steps', async () => {
    connectProvider();
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /new workflow/i }));

    const draft = screen.getByRole('button', { name: /Draft steps/ }) as HTMLButtonElement;
    expect(draft.disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Add step' })).toBeDefined();

    fireEvent.change(screen.getByLabelText('Goal'), {
      target: { value: 'Replay settled batches behind a dry run flag' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Draft steps/ }));

    await waitFor(() => expect(state.startWorkflowGeneration).toHaveBeenCalledOnce());
    expect(state.startWorkflowGeneration.mock.calls[0]?.[0]).toMatchObject({
      workspaceId: 'ws-1',
      description: 'Replay settled batches behind a dry run flag',
      workflow: null,
    });
  });

  it('asks before redrafting existing steps', async () => {
    connectProvider();
    const original = makeWorkflow({ name: 'Plan and build', goal: 'Ship the ledger export' });
    state.phaseTemplates = { 'ws-1': [original] };
    renderPanel();
    openWorkflow('Plan and build');

    fireEvent.click(screen.getByRole('button', { name: /Redraft steps/ }));
    expect(state.startWorkflowGeneration).not.toHaveBeenCalled();
    const confirm = screen.getByRole('group', { name: 'Redraft these steps from the goal?' });
    fireEvent.click(within(confirm).getByRole('button', { name: 'Redraft steps' }));

    await waitFor(() => expect(state.startWorkflowGeneration).toHaveBeenCalledOnce());
    expect(state.startWorkflowGeneration.mock.calls[0]?.[0]).toMatchObject({
      description: 'Ship the ledger export',
      workflow: original,
    });
  });

  it('opens a redrafted workflow and offers an undo back to the previous steps', async () => {
    const previous = makeWorkflow({ name: 'Plan and build' });
    const redrafted = makeWorkflow({
      name: 'Plan and build',
      steps: [
        {
          id: 'step-new',
          role: 'implementer',
          ordinal: 0,
          name: 'Implement',
          promptPrefix: 'Write it',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ],
    });
    state.phaseTemplates = { 'ws-1': [redrafted] };
    state.workflowGenerations = {
      'ws-1': {
        status: 'complete',
        workspaceId: 'ws-1',
        workflowId: 'wf-1',
        notificationId: 'note-1',
        undoSnapshot: previous,
      },
    };
    renderPanel();

    expect(await screen.findByRole('button', { name: 'Step 1: Implement' })).toBeDefined();
    expect(state.consumeWorkflowGeneration).toHaveBeenCalledWith({ workspaceId: 'ws-1' });
    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));
    expect(await screen.findByRole('button', { name: 'Step 1: Plan' })).toBeDefined();
  });

  it('adds a blank step at the tip and opens its editor', () => {
    state.phaseTemplates = { 'ws-1': [makeWorkflow({ name: 'Plan and build' })] };
    renderPanel();
    openWorkflow('Plan and build');

    fireEvent.click(screen.getByRole('button', { name: 'Add step' }));

    expect(screen.getByRole('button', { name: 'Step 2: Custom' })).toBeDefined();
    expect(screen.getByLabelText('Title')).toBeDefined();
  });

  it('duplicates a workflow as an independent preset from the menu', async () => {
    const original = makeWorkflow({ name: 'Plan and build' });
    state.phaseTemplates = { 'ws-1': [original] };
    state.savePhaseTemplate = vi.fn(async (input: unknown) => ({
      ...original,
      ...(input as Record<string, unknown>),
      id: 'wf-copy',
      steps: [],
    }));
    renderPanel();
    openWorkflow('Plan and build');
    openMenuItem('Duplicate');

    await waitFor(() => expect(state.savePhaseTemplate).toHaveBeenCalledOnce());
    const input = state.savePhaseTemplate.mock.calls[0]?.[0];
    expect(input).not.toHaveProperty('id');
    expect(input).toMatchObject({ name: 'Plan and build copy', isPreset: true, origin: 'custom' });
  });

  it('undoes changes since the workflow was opened', () => {
    state.phaseTemplates = { 'ws-1': [makeWorkflow({ name: 'Plan and build' })] };
    renderPanel();
    openWorkflow('Plan and build');
    fireEvent.click(screen.getByRole('button', { name: 'Workflow actions' }));
    expect(screen.queryByRole('menuitem', { name: 'Undo changes since opened' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Workflow actions' }));

    fireEvent.change(screen.getByRole('textbox', { name: 'Workflow name' }), {
      target: { value: 'Plan, build, review' },
    });
    openMenuItem('Undo changes since opened');

    const name = screen.getByRole('textbox', { name: 'Workflow name' }) as HTMLTextAreaElement;
    expect(name.value).toBe('Plan and build');
  });

  it('deletes a workflow after an inline confirm', async () => {
    state.phaseTemplates = { 'ws-1': [makeWorkflow({ name: 'Plan and build' })] };
    renderPanel();
    openWorkflow('Plan and build');
    openMenuItem('Delete');
    const confirm = screen.getByRole('group', { name: 'Delete Plan and build?' });
    fireEvent.click(within(confirm).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(state.deleteWorkflow).toHaveBeenCalledWith('wf-1', 'ws-1'));
    expect(await screen.findByRole('button', { name: 'Open Plan and build' })).toBeDefined();
  });

  it('flushes a restored draft with unsaved edits without a further edit', async () => {
    const original = makeWorkflow({ name: 'Plan and build' });
    state.phaseTemplates = { 'ws-1': [original] };
    state.workflowStudioDrafts = {
      'ws-1': {
        workflowId: 'wf-1',
        form: {
          name: 'Plan and build, revised',
          description: '',
          goal: '',
          steps: [draftStep()],
          origin: 'custom',
          isPreset: true,
        },
      },
    };
    state.savePhaseTemplate = vi.fn(async (input: unknown) => ({
      ...original,
      ...(input as Record<string, unknown>),
    }));
    renderPanel();

    const name = screen.getByRole('textbox', { name: 'Workflow name' }) as HTMLTextAreaElement;
    expect(name.value).toBe('Plan and build, revised');
    await waitFor(() => expect(state.savePhaseTemplate).toHaveBeenCalledOnce(), {
      timeout: 2_000,
    });
    expect(state.savePhaseTemplate.mock.calls[0]?.[0]).toMatchObject({
      name: 'Plan and build, revised',
    });
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
    openWorkflow('Plan and build');
    expect(screen.getByRole('status').textContent).toBe('Saved');

    fireEvent.change(screen.getByRole('textbox', { name: 'Workflow name' }), {
      target: { value: 'Plan, build, review' },
    });

    await waitFor(() => expect(state.savePhaseTemplate).toHaveBeenCalledOnce(), { timeout: 2_000 });
    expect(screen.getByRole('status').textContent).toBe('Saving');
    finishSave(makeWorkflow({ name: 'Plan, build, review' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Saved'));
  });

  it('keeps an autosave failure visible in the editor', async () => {
    state.phaseTemplates = { 'ws-1': [makeWorkflow({ name: 'Plan and build' })] };
    state.savePhaseTemplate = vi.fn(async () => {
      throw new Error('disk is read-only');
    });
    renderPanel();
    openWorkflow('Plan and build');
    fireEvent.change(screen.getByRole('textbox', { name: 'Workflow name' }), {
      target: { value: 'Plan, build, review' },
    });

    const alert = await screen.findByRole('alert', {}, { timeout: 2_000 });
    expect(alert.textContent).toContain('disk is read-only');
  });

  it('refuses to save a named workflow without steps', async () => {
    state.phaseTemplates = { 'ws-1': [makeWorkflow({ name: 'Plan and build' })] };
    state.workflowStudioDrafts = {
      'ws-1': {
        workflowId: 'wf-1',
        form: {
          name: 'Plan and build, emptied',
          description: '',
          goal: '',
          steps: [],
          origin: 'custom',
          isPreset: true,
        },
      },
    };
    renderPanel();

    const alert = await screen.findByRole('alert', {}, { timeout: 2_000 });
    expect(alert.textContent).toContain('Add at least one step');
    expect(state.savePhaseTemplate).not.toHaveBeenCalled();
  });
});

describe('WorkflowsPanel import', () => {
  const sourceProject = {
    id: 'project-source',
    workspaceId: 'ws-source',
    name: 'ledger-core',
    rootPath: '/source',
    kind: 'repo',
  };

  const sourceRow = (overrides: Record<string, unknown> = {}) => ({
    ...makeWorkflow({
      id: 'wf-source',
      workspaceId: 'ws-source',
      name: 'Source review',
      origin: 'custom',
    }),
    ...overrides,
  });

  const openImport = () => {
    state.projects = [sourceProject];
    state.workspaces = [{ id: 'ws-source', name: 'Northwind' }];
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
  };

  it('imports a workflow from another workspace and opens the copy', async () => {
    invokeMock.mockResolvedValueOnce([sourceRow()]);
    const imported = makeWorkflow({ id: 'wf-imported', name: 'Source review 2' });
    state.copyWorkflowFromWorkspace = vi.fn(async () => imported);
    openImport();

    fireEvent.change(screen.getByLabelText('Project'), { target: { value: 'project-source' } });
    await screen.findByRole('option', { name: 'Source review' });
    fireEvent.change(screen.getByLabelText('Workflow'), { target: { value: 'wf-source' } });
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Import workflows' })).getByRole('button', {
        name: 'Import',
      }),
    );

    await waitFor(() =>
      expect(state.copyWorkflowFromWorkspace).toHaveBeenCalledWith({
        sourceWorkspaceId: 'ws-source',
        sourceWorkflowId: 'wf-source',
        targetWorkspaceId: 'ws-1',
      }),
    );
    const name = screen.getByRole('textbox', { name: 'Workflow name' }) as HTMLTextAreaElement;
    expect(name.value).toBe('Source review 2');
  });

  it('excludes a seeded library preset from the import list', async () => {
    invokeMock.mockResolvedValueOnce([sourceRow({ origin: 'library' })]);
    openImport();

    fireEvent.change(screen.getByLabelText('Project'), { target: { value: 'project-source' } });

    expect(await screen.findByText('No workflows to import')).toBeDefined();
  });
});
