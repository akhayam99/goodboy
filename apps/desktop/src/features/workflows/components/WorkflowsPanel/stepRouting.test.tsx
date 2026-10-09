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

const library = vi.hoisted(() => ({
  defs: [] as ReadonlyArray<StepDef>,
  upserts: [] as ReadonlyArray<StepDefUpsertArgs>,
}));

vi.mock('../../workflows', async () => ({
  ...(await import('../../../../store/storyHarness')).workflowsModuleMock(),
  invokeStepDefList: async () => library.defs,
  invokeStepDefUpsert: async (args: StepDefUpsertArgs): Promise<StepDef> => {
    library.upserts = [...library.upserts, args];
    return {
      ...args,
      id: args.id ?? ('lib-new' as StepDefId),
      createdAt: NOW,
      updatedAt: NOW,
    };
  },
}));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { PROVIDER_CAPABILITIES } from '@goodboy/core';
import type {
  IsoDateTime,
  ProviderId,
  StepDef,
  StepDefId,
  StepId,
  Workflow,
  WorkflowId,
} from '@goodboy/types';
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
import type { StepDefUpsertArgs, WorkflowUpsertArgs } from '../../workflows';
import { WorkflowsPanel } from './index';

const NOW = '2026-10-01T10:00:00.000Z' as IsoDateTime;
const WORKSPACE = aWorkspace();
const WORKFLOW_NAME = 'Harborline release check';
const STEP_NAME = 'Check ledger-core';
const SAVED_STEP_NAME = 'Dry run replay';

let useAppStore: StoryStore;
let persisted: ReadonlyArray<Workflow> = [];

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
  const id = args.id ?? ('workflow-new' as WorkflowId);
  const workflow: Workflow = {
    ...args,
    id,
    steps: args.steps.map((step, index) => ({
      ...step,
      id: step.id ?? (`step-${index}` as StepId),
      workflowId: id,
      createdAt: NOW,
      updatedAt: NOW,
    })),
    createdAt: NOW,
    updatedAt: NOW,
  };
  persisted = [workflow];
  return workflow;
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  persisted = [];
  library.defs = [];
  library.upserts = [];
  storySpies.invokeWorkflowList.mockImplementation(async () => persisted);
  storySpies.invokeWorkflowUpsert.mockImplementation(async (args) => persist(args));
  useAppStore.setState({
    workspaces: [WORKSPACE],
    providers: [connected('anthropic'), connected('codex'), connected('cursor')],
  });
});

afterEach(cleanup);

const renderPanel = () =>
  render(
    <ToastProvider>
      <WorkflowsPanel workspaceId={WORKSPACE.id} />
    </ToastProvider>,
  );

const routingGroup = () => screen.getByRole('group', { name: /Routing for/ });

const pickProvider = (name: RegExp) => {
  fireEvent.click(within(routingGroup()).getByRole('button', { name }));
};

type ChipParams = {
  readonly group: string;
  readonly name: string;
};

const pickChip = ({ group, name }: ChipParams) => {
  const row = within(routingGroup()).getByRole('group', { name: group });
  fireEvent.click(within(row).getByRole('button', { name }));
};

const pickOpus55Medium = () => {
  pickChip({ group: 'Model', name: 'Opus' });
  pickChip({ group: 'Version', name: '5.5' });
  pickChip({ group: 'Effort', name: 'Medium' });
};

const pressed = (): ReadonlyArray<string> =>
  Array.from(routingGroup().querySelectorAll('button[aria-pressed="true"]')).map(
    (button) => button.getAttribute('aria-label') ?? button.textContent ?? '',
  );

const startPreset = () => {
  renderPanel();
  fireEvent.click(screen.getByRole('button', { name: /new workflow/i }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Workflow name' }), {
    target: { value: WORKFLOW_NAME },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Add step' }));
  fireEvent.click(screen.getByRole('option', { name: /Blank step/ }));
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: STEP_NAME } });
  fireEvent.click(screen.getByRole('tab', { name: 'Pin a model' }));
};

type StoredStep = {
  readonly providerOverride?: string;
  readonly modelOverride?: string;
  readonly effort?: string;
};

const expectSavedStep = async (expected: StoredStep) => {
  await waitFor(() => expect(persisted[0]?.steps[0]).toMatchObject(expected), { timeout: 3_000 });
};

const reopenStep = async () => {
  await waitFor(
    () =>
      expect(screen.getAllByRole('status').map((element) => element.textContent)).toContain(
        'Saved',
      ),
    { timeout: 3_000 },
  );
  fireEvent.click(
    within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getByRole('button', {
      name: 'Workflows',
    }),
  );
  fireEvent.click(screen.getByRole('button', { name: `Open ${WORKFLOW_NAME}` }));
  fireEvent.click(screen.getByRole('button', { name: `Step 1: ${STEP_NAME}` }));
  fireEvent.click(screen.getByRole('tab', { name: 'Pin a model' }));
};

describe('model picked on a preset step in the Workflows studio', () => {
  it.each(['anthropic', 'codex'] as const)(
    'keeps Cursor, Opus 5.5 and Medium when the step starts on %s, and after reopening',
    async (startProvider) => {
      useAppStore.setState({
        workspaceOverrides: {
          [WORKSPACE.id]: { ...emptyOverrides, defaultProviderId: startProvider },
        },
      });
      startPreset();
      pickProvider(/^Cursor/);
      expect(pressed()[0]).toMatch(/^Cursor/);
      pickOpus55Medium();

      expect(pressed()).toEqual([expect.stringMatching(/^Cursor/), 'Opus', '5.5', 'Medium']);
      await expectSavedStep({
        providerOverride: 'cursor',
        modelOverride: 'claude-opus-5-5-medium',
        effort: 'medium',
      });

      await reopenStep();
      expect(pressed()).toEqual([expect.stringMatching(/^Cursor/), 'Opus', '5.5', 'Medium']);
    },
  );

  it('keeps Claude, Opus 5.5 and Medium, and after reopening', async () => {
    startPreset();
    pickOpus55Medium();

    await expectSavedStep({
      providerOverride: 'anthropic',
      modelOverride: 'claude-opus-5-5',
      effort: 'medium',
    });

    await reopenStep();
    expect(pressed()).toEqual([expect.stringMatching(/^Claude/), 'Opus', '5.5', 'Medium']);
  });

  it('moves a step from Cursor to Codex and back to Claude without flipping the provider', async () => {
    startPreset();
    pickProvider(/^Cursor/);
    pickChip({ group: 'Model', name: 'Opus' });
    pickChip({ group: 'Version', name: '5.5' });
    pickProvider(/^Codex/);
    expect(pressed()[0]).toMatch(/^Codex/);
    await expectSavedStep({ providerOverride: 'codex' });

    pickProvider(/^Claude/);
    expect(pressed()[0]).toMatch(/^Claude/);
    await expectSavedStep({ providerOverride: 'anthropic' });
  });
});

describe('model picked on a saved step in the Workflows studio', () => {
  it('keeps Cursor, Opus 5.5 and Medium when the step is saved', async () => {
    library.defs = [
      {
        id: 'lib-replay' as StepDefId,
        workspaceId: WORKSPACE.id,
        role: 'tester',
        name: SAVED_STEP_NAME,
        promptPrefix: 'Replay settled batches with the dry run flag on.',
        baseStepId: 'seed_tester' as StepDefId,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ];
    renderPanel();
    fireEvent.click(screen.getByRole('tab', { name: /Saved steps/ }));
    fireEvent.click(await screen.findByRole('button', { name: `Open ${SAVED_STEP_NAME}` }));
    fireEvent.click(screen.getByRole('tab', { name: 'Pin a model' }));
    pickProvider(/^Cursor/);
    pickOpus55Medium();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    await waitFor(() => expect(library.upserts).toHaveLength(1));
    expect(library.upserts[0]).toMatchObject({
      providerDefault: 'cursor',
      modelDefault: 'claude-opus-5-5-medium',
      effortDefault: 'medium',
    });
  });
});
