// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).sqliteDbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  brandId,
  DEFAULT_WORKFLOW_RULES,
  type AgentId,
  type IsoDateTime,
  type RunRoute,
  type StepId,
  type Workflow,
  type WorkflowId,
  type WorkflowRunId,
} from '@goodboy/types';
import { aSession, aWorkflowRun, aWorkspace, anAgent } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  openStorySqlite,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { RunKindChip } from './RunKindChip';

const WORKSPACE = aWorkspace({ name: 'Northwind' });
const SESSION = aSession({ workspaceId: WORKSPACE.id, goal: 'Member pages' });
const NOW = brandId<IsoDateTime>({ value: '2026-10-22T09:00:00.000Z' });
const RUN_ID = brandId<WorkflowRunId>({ value: 'run-members' });
const LAYOUT_ID = brandId<WorkflowId>({ value: 'workflow-layout' });
const LAYOUT: Workflow = {
  id: LAYOUT_ID,
  workspaceId: WORKSPACE.id,
  name: 'Fix a layout',
  description: '',
  steps: [
    {
      id: brandId<StepId>({ value: 'step-find' }),
      workflowId: LAYOUT_ID,
      ordinal: 0,
      name: 'Find',
      role: 'scout',
      promptPrefix: '',
    },
  ],
  isPreset: true,
  origin: 'custom',
  createdAt: NOW,
  updatedAt: NOW,
};
const ROUTE: RunRoute = {
  shape: 'plan',
  row: 2,
  presetName: 'Fix a layout',
  closeness: 'adapt',
  role: null,
  choice: 'Workflow · Preset Fix a layout · Adapt as it goes',
  why: 'Your ask matches the preset',
  ask: 'Center the member pages',
};
const TARGET = { kind: 'plan' as const, sessionId: SESSION.id, runId: RUN_ID };
const NEW_AGENT = brandId<AgentId>({ value: 'agent-payments-api' });
const CHIP = 'Kind: Workflow · Preset Fix a layout, set at start';

let useAppStore: StoryStore;

type StoryState = ReturnType<StoryStore['getState']>;

type RenderParams = {
  readonly hasStarted: boolean;
};

const openChip = ({ hasStarted }: RenderParams) => {
  render(
    <RunKindChip
      workspaceId={WORKSPACE.id}
      target={TARGET}
      route={ROUTE}
      changeCount={1}
      hasStarted={hasStarted}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: CHIP }));
  return screen.getByRole('dialog', { name: 'Kind' });
};

const seedWork = () => {
  const spawnAgent = vi.fn<StoryState['spawnAgent']>(async () => NEW_AGENT);
  const stopWorkflowRunNow = vi.fn<StoryState['stopWorkflowRunNow']>(async () => undefined);
  useAppStore.setState({
    spawnAgent,
    stopWorkflowRunNow,
    sessionPhaseRuns: {
      [SESSION.id]: [
        anAgent({
          sessionId: SESSION.id,
          workflowRunId: RUN_ID,
          name: 'Scout the member pages',
          status: 'completed',
          outputSummary: 'Six pages share one wrapper',
        }),
      ],
    },
  });
  return { spawnAgent, stopWorkflowRunNow };
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  await openStorySqlite();
  useAppStore.setState({
    workspaces: [WORKSPACE],
    sessions: [
      {
        ...SESSION,
        workflowRuns: [
          aWorkflowRun({
            id: RUN_ID,
            executionMode: 'dynamic',
            rulesSnapshot: { ...DEFAULT_WORKFLOW_RULES, route: ROUTE },
          }),
        ],
      },
    ],
    phaseTemplates: { [WORKSPACE.id]: [LAYOUT] },
  });
});

afterEach(cleanup);

describe('RunKindChip', () => {
  it('names the kind with the start page words and keeps why and closeness in its popover', () => {
    const popover = openChip({ hasStarted: true });

    expect(popover.querySelector('[data-run-kind-why]')?.textContent).toBe(
      'Why: Your ask matches the preset · 1 change',
    );
    const selected = within(popover)
      .getAllByRole('tab')
      .filter((tab) => tab.getAttribute('aria-selected') === 'true')
      .map((tab) => tab.textContent);
    expect(selected).toEqual(['Adapt as it goes']);
    const startAs = within(popover).getByRole('group', { name: 'Start a new run as' });
    expect(
      within(startAs)
        .getAllByRole('button')
        .map((row) => row.textContent),
    ).toEqual(['Workflow · Orchestrated', 'Agent · Auto agent']);
    expect(popover.textContent).toContain(
      'Starts a second run with the same goal. This one keeps going.',
    );
    expect(popover.textContent).not.toContain('Start every run in this session');
  });

  it('says the change applies to this run before its first step', () => {
    const popover = openChip({ hasStarted: false });

    within(popover).getByRole('group', { name: 'Change it to' });
    expect(popover.textContent).toContain('Changes this run before its first step.');
  });

  it('switches to Follow it in place and keeps the run', async () => {
    const popover = openChip({ hasStarted: true });

    fireEvent.click(within(popover).getByRole('tab', { name: 'Follow it' }));

    await waitFor(() =>
      expect(
        useAppStore.getState().sessions[0]?.workflowRuns[0]?.rulesSnapshot?.route?.closeness,
      ).toBe('follow'),
    );
    expect(useAppStore.getState().sessions[0]?.workflowRuns[0]?.id).toBe(RUN_ID);
  });

  it('starts a second run as the picked kind and leaves this one running', async () => {
    const engines = seedWork();
    const popover = openChip({ hasStarted: true });

    await act(async () => {
      fireEvent.click(within(popover).getByRole('button', { name: 'Agent · Auto agent' }));
    });

    await waitFor(() => expect(engines.spawnAgent).toHaveBeenCalledTimes(1));
    expect(engines.spawnAgent.mock.calls[0]?.[1].initialPrompt).toContain(
      'Six pages share one wrapper',
    );
    expect(engines.stopWorkflowRunNow).not.toHaveBeenCalled();
    expect(useAppStore.getState().sessions[0]?.workflowRuns[0]?.rulesSnapshot?.route).toEqual(
      ROUTE,
    );
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Kind' })).toBeNull());
  });

  it('keeps the popover open with the reason when the second run cannot start', async () => {
    const engines = seedWork();
    engines.spawnAgent.mockRejectedValueOnce(new Error('No provider is connected'));
    const popover = openChip({ hasStarted: true });

    await act(async () => {
      fireEvent.click(within(popover).getByRole('button', { name: 'Agent · Auto agent' }));
    });

    expect((await within(popover).findByRole('alert')).textContent).toBe(
      "Couldn't change the run: No provider is connected",
    );
    screen.getByRole('dialog', { name: 'Kind' });
  });
});
