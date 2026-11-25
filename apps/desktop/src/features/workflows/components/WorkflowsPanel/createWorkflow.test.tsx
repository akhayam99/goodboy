// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../store/storyHarness')).dbModuleMock({
    listRemovedSeededWorkflowIds: async () => [],
  }),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);
vi.mock('../../workflows', async () =>
  (await import('../../../../store/storyHarness')).workflowsModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { PROVIDER_CAPABILITIES } from '@goodboy/core/providers';
import type { IsoDateTime, ProviderId, StepId, Workflow, WorkflowId } from '@goodboy/types';
import { brandId } from '@goodboy/types';
import { aWorkspace } from '@goodboy/types/testing';
import type { AppStore } from '../../../../store/store';
import {
  STORE_IMPORT_TIMEOUT_MS,
  emptyOverrides,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ToastProvider } from '../../../../shared/components/Toast';
import type { WorkflowUpsertArgs } from '../../workflows';
import { WorkflowsPanel } from './index';

const NOW = brandId<IsoDateTime>({ value: '2026-10-01T10:00:00.000Z' });
const idOf = (value: string) => brandId<WorkflowId>({ value });
const WORKSPACE = aWorkspace();
const NAME = 'Harborline release check';
const STEP = 'Check ledger-core';

let useAppStore: StoryStore;
let persisted: ReadonlyArray<Workflow> = [];
let writes: ReadonlyArray<WorkflowUpsertArgs> = [];

const connected = (id: ProviderId): AppStore['providers'][number] => ({
  id,
  binary: id,
  capabilities: PROVIDER_CAPABILITIES[id],
  connection: 'connected',
  version: null,
  identity: null,
  label: id,
  error: null,
  docsUrl: '',
});

const persist = (args: WorkflowUpsertArgs): Workflow => {
  const id = args.id ?? idOf('workflow-new');
  const workflow: Workflow = {
    ...args,
    id,
    steps: args.steps.map((step, index) => ({
      ...step,
      id: step.id ?? brandId<StepId>({ value: `step-${index}` }),
      workflowId: id,
    })),
    createdAt: NOW,
    updatedAt: NOW,
  };
  persisted = [workflow];
  return workflow;
};

const held = (id: string): Workflow => ({
  id: idOf(id),
  workspaceId: WORKSPACE.id,
  name: NAME,
  description: '',
  isPreset: true,
  steps: [],
  createdAt: NOW,
  updatedAt: NOW,
});

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  persisted = [];
  writes = [];
  storySpies.invokeWorkflowList.mockImplementation(async () => persisted);
  storySpies.invokeWorkflowUpsert.mockImplementation(async (args) => {
    writes = [...writes, args];
    return persist(args);
  });
  useAppStore.setState({
    workspaces: [WORKSPACE],
    providers: [connected('anthropic'), connected('codex')],
    workspaceOverrides: { [WORKSPACE.id]: { ...emptyOverrides, defaultProviderId: 'anthropic' } },
  });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

const renderPanel = () =>
  render(
    <ToastProvider>
      <WorkflowsPanel workspaceId={WORKSPACE.id} />
    </ToastProvider>,
  );

const openNew = () => {
  renderPanel();
  fireEvent.click(screen.getByRole('button', { name: /new workflow/i }));
};

const typeName = (value: string) =>
  fireEvent.change(screen.getByRole('textbox', { name: 'Workflow name' }), { target: { value } });

const addNamedStep = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Add step' }));
  fireEvent.click(screen.getByRole('option', { name: /Blank step/ }));
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: STEP } });
};

const createButton = () => screen.getByRole('button', { name: /Create workflow|Retry/ });

describe('creating a workflow', () => {
  it('starts from Every run and asks for the five parts in order', () => {
    openNew();

    screen.getByRole('heading', { name: 'New workflow' });
    const labels = screen
      .getAllByRole('heading', { level: 2 })
      .map((heading) => heading.textContent);
    expect(labels).toEqual([
      'Name',
      'Use it when',
      'First, check',
      'Stop and ask when',
      'Then suggest',
      'Keep steps in order',
      'Models',
    ]);
    screen.getByLabelText('Use it when');
    screen.getByText('Same as Every run');
    expect(
      screen.getByRole('tab', { name: 'The Lead may adapt' }).getAttribute('aria-selected'),
    ).toBe('true');
    expect(screen.queryByRole('group', { name: /Routing for/ })).toBeNull();
  });

  it('says why Create is off at each step', async () => {
    openNew();
    expect(createButton()).toHaveProperty('disabled', true);
    screen.getByText('Name it first');

    typeName(NAME);
    expect(createButton()).toHaveProperty('disabled', true);
    screen.getByText('Add one step or draft them');

    addNamedStep();
    await waitFor(() => expect(createButton()).toHaveProperty('disabled', false));
    expect(screen.queryByText('Add one step or draft them')).toBeNull();
  });

  it('never writes a new draft before Create, however long it sits', async () => {
    vi.useFakeTimers();
    openNew();
    typeName(NAME);
    addNamedStep();
    fireEvent.change(screen.getByLabelText('Stop and ask when'), {
      target: { value: 'It never fails' },
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(writes).toHaveLength(0);
    vi.useRealTimers();
  });

  it('writes once on Create and becomes the page of that workflow', async () => {
    openNew();
    typeName(NAME);
    fireEvent.change(screen.getByLabelText('First, check'), {
      target: { value: 'Run the check ten times' },
    });
    fireEvent.change(screen.getByLabelText('Stop and ask when'), {
      target: { value: 'It never fails' },
    });
    fireEvent.click(screen.getByRole('tab', { name: 'Keep this order' }));
    addNamedStep();

    fireEvent.click(createButton());

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toMatchObject({
      name: NAME,
      entryCheck: 'Run the check ten times',
      stopRule: 'It never fails',
      thenSuggestId: null,
      isOrderKept: true,
    });
    expect(writes[0]).not.toHaveProperty('id');
    await waitFor(() =>
      expect(screen.getAllByRole('status').map((s) => s.textContent)).toContain('Saved'),
    );
    expect(screen.queryByRole('button', { name: /Create workflow/ })).toBeNull();
    expect(screen.getByLabelText('Workflow name')).toHaveProperty('value', NAME);

    fireEvent.change(screen.getByLabelText('First, check'), { target: { value: 'Run it twice' } });
    await waitFor(() => expect(writes).toHaveLength(2), { timeout: 3_000 });
    expect(writes[1]).toHaveProperty('id', 'workflow-new');
  });

  it('refuses a name another workflow already holds and writes nothing', async () => {
    persisted = [held('wf-held')];
    useAppStore.setState({ phaseTemplates: { [WORKSPACE.id]: persisted } });
    openNew();
    typeName(NAME);
    addNamedStep();

    screen.getByText(`A workflow named ${NAME} exists`);
    expect(createButton()).toHaveProperty('disabled', true);
    expect(writes).toHaveLength(0);
  });

  it('catches a name taken from a second window at Create', async () => {
    openNew();
    typeName(NAME);
    addNamedStep();
    persisted = [held('wf-late')];

    fireEvent.click(createButton());

    expect(await screen.findByText(`A workflow named ${NAME} exists`)).toBeDefined();
    expect(writes).toHaveLength(0);
  });

  it('keeps every field when Create fails and creates on the next try', async () => {
    openNew();
    typeName(NAME);
    fireEvent.change(screen.getByLabelText('Stop and ask when'), {
      target: { value: 'It never fails' },
    });
    addNamedStep();
    storySpies.invokeWorkflowUpsert.mockImplementationOnce(async () => {
      throw new Error('disk is read-only');
    });

    fireEvent.click(createButton());

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('disk is read-only');
    expect(screen.getByLabelText('Workflow name')).toHaveProperty('value', NAME);
    expect(screen.getByLabelText('Stop and ask when')).toHaveProperty('value', 'It never fails');
    expect(writes).toHaveLength(0);

    fireEvent.click(createButton());
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toMatchObject({ name: NAME, stopRule: 'It never fails' });
  });

  it('drafts steps without writing and fills the form', async () => {
    useAppStore.setState({
      startWorkflowGeneration: async ({ draftKey }) => {
        useAppStore.setState({
          workflowGenerations: {
            [WORKSPACE.id]: {
              status: 'drafted',
              draftKey: draftKey ?? 0,
              workspaceId: WORKSPACE.id,
              notificationId: 'n-1',
              name: 'Drafted name',
              steps: [
                { ordinal: 0, name: 'Reproduce', promptPrefix: 'Reproduce it', role: 'scout' },
              ],
            },
          },
        });
        return true;
      },
    });
    openNew();
    fireEvent.change(screen.getByLabelText('Use it when'), {
      target: { value: 'A test fails some of the time' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Draft steps/ }));

    expect(await screen.findByRole('button', { name: 'Step 1: Reproduce' })).toBeDefined();
    expect(screen.getByLabelText('Workflow name')).toHaveProperty('value', 'Drafted name');
    expect(writes).toHaveLength(0);
  });

  it('shows a failed draft inline and keeps the fields', async () => {
    useAppStore.setState({
      workflowGenerations: {
        [WORKSPACE.id]: { status: 'failed', description: 'x', error: 'no model answered' },
      },
    });
    openNew();
    typeName(NAME);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain("Couldn't draft steps. no model answered");
    expect(screen.getByLabelText('Workflow name')).toHaveProperty('value', NAME);
    screen.getByRole('button', { name: /Draft steps/ });
  });

  it('keeps the actions at the end of the content, in the form actions slot', () => {
    openNew();
    const actions = document.querySelector('[data-slot="form-actions"]');
    expect(actions).not.toBeNull();
    expect(actions).not.toBeNull();
    screen.getByRole('button', { name: 'Discard' });
    expect(actions?.nextElementSibling).toBeNull();
  });
});

describe('a draft that changes under a pending request', () => {
  const draftedWith = (draftKey: number) => ({
    [WORKSPACE.id]: {
      status: 'drafted' as const,
      draftKey,
      workspaceId: WORKSPACE.id,
      notificationId: `n-${draftKey}`,
      name: 'Drafted name',
      steps: [
        { ordinal: 0, name: 'Reproduce', promptPrefix: 'Reproduce it', role: 'scout' as const },
      ],
    },
  });

  it('drops steps drafted for a draft that is not the open one', async () => {
    openNew();
    typeName('Another draft');
    useAppStore.setState({ workflowGenerations: draftedWith(-1) });

    await waitFor(() =>
      expect(useAppStore.getState().workflowGenerations[WORKSPACE.id]).toEqual({ status: 'idle' }),
    );
    expect(screen.queryByRole('button', { name: 'Step 1: Reproduce' })).toBeNull();
    expect(screen.getByLabelText('Workflow name')).toHaveProperty('value', 'Another draft');
  });

  it('offers Undo that brings the earlier steps back after a redraft', async () => {
    useAppStore.setState({
      startWorkflowGeneration: async ({ draftKey }) => {
        useAppStore.setState({ workflowGenerations: draftedWith(draftKey ?? 0) });
        return true;
      },
    });
    openNew();
    typeName(NAME);
    addNamedStep();
    fireEvent.change(screen.getByLabelText('Use it when'), { target: { value: 'A test fails' } });

    fireEvent.click(screen.getByRole('button', { name: /Redraft steps/ }));

    await screen.findByRole('button', { name: 'Step 1: Reproduce' });
    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));
    await screen.findByRole('button', { name: `Step 1: ${STEP}` });
  });

  it('leaves the page alone when Create finishes after you left the draft', async () => {
    let finish: () => void = () => undefined;
    storySpies.invokeWorkflowUpsert.mockImplementationOnce(
      (args) =>
        new Promise((resolve) => {
          finish = () => resolve(persist(args));
        }),
    );
    openNew();
    typeName(NAME);
    addNamedStep();

    fireEvent.click(createButton());
    expect(screen.getByRole('button', { name: /Draft steps|Redraft steps/ })).toHaveProperty(
      'disabled',
      true,
    );
    fireEvent.click(
      within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getByRole('button', {
        name: 'Workflows',
      }),
    );
    await act(async () => {
      finish();
    });

    expect(await screen.findByRole('button', { name: /new workflow/i })).toBeDefined();
    expect(screen.queryByLabelText('Workflow name')).toBeNull();
  });
});

describe('the page of a saved workflow', () => {
  const wfId = idOf('wf-1');
  const saved = (overrides: Partial<Workflow> = {}): Workflow => ({
    id: wfId,
    workspaceId: WORKSPACE.id,
    name: NAME,
    description: 'A test fails some of the time',
    entryCheck: 'Run it ten times',
    stopRule: 'It never fails',
    isPreset: true,
    steps: [
      {
        id: brandId<StepId>({ value: 's-1' }),
        workflowId: wfId,
        ordinal: 0,
        name: STEP,
        role: 'reviewer',
        promptPrefix: 'Check it',
        providerOverride: 'codex',
        modelOverride: 'gpt-5.6-terra',
      },
    ],
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  });

  const openSaved = () => {
    persisted = [saved()];
    useAppStore.setState({ phaseTemplates: { [WORKSPACE.id]: persisted } });
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: `Open ${NAME}` }));
  };

  it('shows each guide field and saves a change', async () => {
    openSaved();

    expect(screen.getByLabelText('First, check')).toHaveProperty('value', 'Run it ten times');
    expect(screen.getByLabelText('Stop and ask when')).toHaveProperty('value', 'It never fails');
    fireEvent.change(screen.getByLabelText('Stop and ask when'), {
      target: { value: 'It fails every time' },
    });
    fireEvent.click(screen.getByRole('tab', { name: 'Keep this order' }));

    await waitFor(() => expect(writes.length).toBeGreaterThan(0), { timeout: 3_000 });
    expect(writes.at(-1)).toMatchObject({
      id: 'wf-1',
      entryCheck: 'Run it ten times',
      stopRule: 'It fails every time',
      isOrderKept: true,
    });
  });

  it('puts a model override in full and Reset sends the role back to Every run', async () => {
    openSaved();

    const row = document.querySelector<HTMLElement>('[data-workflow-model="reviewer"]');
    if (row === null) {
      throw new Error('no Reviewer row');
    }
    expect(within(row).queryByText(/Same as Every run/)).toBeNull();
    fireEvent.click(
      within(row).getByRole('button', { name: /Reset Reviewer to Same as Every run/ }),
    );

    within(row).getByText(/Same as Every run/);
    await waitFor(() => expect(writes.length).toBeGreaterThan(0), { timeout: 3_000 });
    const step = writes.at(-1)?.steps[0];
    expect(step).not.toHaveProperty('providerOverride');
    expect(step).not.toHaveProperty('modelOverride');
  });

  it('renders no provider choice per role and none of the old routing words', () => {
    openSaved();

    expect(screen.queryByRole('group', { name: /Routing for/ })).toBeNull();
    expect(screen.queryByText(/Balanced|In order|Provider priority/)).toBeNull();
  });

  it('suggests another workflow from the workspace list', async () => {
    const other = saved({ id: idOf('wf-2'), name: 'Plan and ship' });
    persisted = [saved(), other];
    useAppStore.setState({ phaseTemplates: { [WORKSPACE.id]: persisted } });
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: `Open ${NAME}` }));

    fireEvent.click(screen.getByRole('combobox', { name: /Then suggest/ }));
    fireEvent.click(await screen.findByRole('option', { name: /Plan and ship/ }));

    await waitFor(() => expect(writes.length).toBeGreaterThan(0), { timeout: 3_000 });
    expect(writes.at(-1)).toMatchObject({ thenSuggestId: 'wf-2' });
  });
});
