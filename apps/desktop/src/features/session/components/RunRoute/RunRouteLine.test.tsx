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
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { getSetting } from '@goodboy/db';
import {
  brandId,
  DEFAULT_WORKFLOW_RULES,
  type IsoDateTime,
  type RunRoute,
  type StepId,
  type Workflow,
  type WorkflowId,
  type WorkflowRunId,
} from '@goodboy/types';
import { aSession, aWorkflowRun, aWorkspace } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  openStorySqlite,
  resetStoryStore,
  storySqlite,
  type StoryStore,
} from '../../../../store/storyHarness';
import { runDefaultKey } from '../../startRun/runDefaultSetting';
import { RunRouteLine } from './RunRouteLine';

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

let useAppStore: StoryStore;

type RenderParams = {
  readonly route: RunRoute;
};

const renderLine = ({ route }: RenderParams) =>
  render(<RunRouteLine workspaceId={WORKSPACE.id} target={TARGET} route={route} changeCount={0} />);

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

describe('RunRouteLine', () => {
  it('says what was chosen and why in one line', () => {
    renderLine({ route: ROUTE });

    screen.getByText(ROUTE.choice);
    screen.getByText(ROUTE.why);
    screen.getByRole('button', { name: /Change/ });
  });

  it('checks the current shape, preset and closeness in the Change menu', () => {
    renderLine({ route: ROUTE });

    fireEvent.click(screen.getByRole('button', { name: /Change/ }));

    const checked = screen
      .getAllByRole('menuitemradio')
      .filter((row) => row.getAttribute('aria-checked') === 'true')
      .map((row) => row.textContent);
    expect(checked).toEqual(['Workflow · Orchestrated', 'Fix a layout', 'Adapt as it goes']);
    screen.getByRole('group', { name: 'Run it as' });
  });

  it('moves through the Change menu with the arrow keys', () => {
    renderLine({ route: ROUTE });

    fireEvent.click(screen.getByRole('button', { name: /Change/ }));
    const menu = screen.getByRole('menu', { name: 'How Auto runs this' });

    expect(document.activeElement).toBe(
      screen.getByRole('menuitemradio', { name: 'Workflow · Orchestrated' }),
    );
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(
      screen.getByRole('menuitemradio', { name: 'Agent · Auto agent' }),
    );
    fireEvent.keyDown(menu, { key: 'End' });
    expect(document.activeElement).toBe(
      screen.getByRole('menuitem', { name: 'Start every run in this session like this' }),
    );
  });

  it('switches to Follow it from the menu and keeps the run', async () => {
    renderLine({ route: ROUTE });

    fireEvent.click(screen.getByRole('button', { name: /Change/ }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Follow it' }));

    await waitFor(() =>
      expect(
        useAppStore.getState().sessions[0]?.workflowRuns[0]?.rulesSnapshot?.route?.closeness,
      ).toBe('follow'),
    );
    expect(useAppStore.getState().sessions[0]?.workflowRuns[0]?.id).toBe(RUN_ID);
  });

  it('sets the session default from the menu and offers Undo', async () => {
    renderLine({ route: ROUTE });

    fireEvent.click(screen.getByRole('button', { name: /Change/ }));
    fireEvent.click(
      screen.getByRole('menuitem', { name: 'Start every run in this session like this' }),
    );

    await waitFor(async () =>
      expect(
        await getSetting(
          storySqlite(),
          runDefaultKey({ scope: { kind: 'session', sessionId: SESSION.id } }),
        ),
      ).toBe('plan'),
    );
    expect(useAppStore.getState().undoStack).toHaveLength(1);
  });

  it('shows what a changed run became instead of Change', () => {
    renderLine({ route: { ...ROUTE, changedTo: 'lead' } });

    screen.getByText('Changed to an Auto agent');
    expect(screen.queryByRole('button', { name: /Change/ })).toBeNull();
  });
});
