// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../../store/storyHarness')).dbModuleMock(),
);

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Agent, Session, SessionId, WorkflowRun, WorkspaceId } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';

let useAppStore: StoryStore;
let OverviewActions: typeof import('./index').OverviewActions;

beforeAll(async () => {
  useAppStore = await importStore();
  ({ OverviewActions } = await import('./index'));
}, STORE_IMPORT_TIMEOUT_MS);

const SESSION_ID = 'session-1' as SessionId;

const SESSION: Session = aSession({
  id: SESSION_ID,
  workspaceId: 'workspace-1' as WorkspaceId,
  goal: 'Ship the thing',
});

const RUN = {
  id: JSON.parse(JSON.stringify('run-1')),
  workflowId: JSON.parse(JSON.stringify('workflow-1')),
  ordinal: 0,
  currentStep: 0,
  autoRun: false,
  triggerMode: 'manual',
  executionMode: 'static',
} satisfies WorkflowRun;

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({ sessions: [SESSION] });
});

afterEach(cleanup);

type RenderParams = {
  readonly session?: Session;
  readonly onOpenWorkflowBuilder?: () => void;
  readonly onOpenRun?: () => void;
};

const renderActions = ({
  session = SESSION,
  onOpenWorkflowBuilder = vi.fn(),
  onOpenRun = vi.fn(),
}: RenderParams = {}) => {
  render(
    <OverviewActions
      session={session}
      onOpenWorkflowBuilder={onOpenWorkflowBuilder}
      onOpenRun={onOpenRun}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: /New/ }));
};

const itemLabels = () =>
  screen
    .getAllByRole('menuitem')
    .map((item) => item.querySelector('.font-medium')?.textContent ?? item.textContent);

describe('OverviewActions', () => {
  it('keeps one New control that lists workflow, agent, report and wireframe', () => {
    renderActions();

    expect(itemLabels()).toEqual(['Start a run', 'Start agent', 'Report', 'Wireframe']);
    expect(screen.queryByRole('button', { name: 'Create' })).toBeNull();
  });

  it('opens the workflow builder from Start a run', () => {
    const onOpenWorkflowBuilder = vi.fn();
    renderActions({ onOpenWorkflowBuilder });

    fireEvent.click(screen.getByRole('menuitem', { name: /Start a run/ }));

    expect(onOpenWorkflowBuilder).toHaveBeenCalledOnce();
  });

  it('swaps to Open run while a workflow run is active', () => {
    const onOpenRun = vi.fn();
    renderActions({ session: { ...SESSION, workflowRuns: [RUN] }, onOpenRun });

    expect(screen.queryByRole('menuitem', { name: /Start a run/ })).toBeNull();
    fireEvent.click(screen.getByRole('menuitem', { name: /Open run/ }));

    expect(onOpenRun).toHaveBeenCalledOnce();
  });

  it('treats a run whose agents all concluded as inactive', () => {
    useAppStore.setState({
      sessionPhaseRuns: {
        [SESSION_ID]: [
          {
            id: JSON.parse(JSON.stringify('agent-1')),
            workflowRunId: RUN.id,
            status: 'completed',
          } as Agent,
        ],
      },
    });
    renderActions({ session: { ...SESSION, workflowRuns: [RUN] } });

    screen.getByRole('menuitem', { name: /Start a run/ });
  });

  it('opens the agent form from Start agent', () => {
    renderActions();

    fireEvent.click(screen.getByRole('menuitem', { name: /Start agent/ }));

    screen.getByRole('dialog', { name: 'Start agent' });
  });

  it.each([
    ['Report', 'report'],
    ['Wireframe', 'wireframe'],
  ] as const)('opens the %s creation from its item', (label, kind) => {
    renderActions();

    fireEvent.click(screen.getByRole('menuitem', { name: new RegExp(`^${label}`) }));

    expect(useAppStore.getState().artifactCreation[SESSION_ID]).toEqual({ kind, note: null });
  });
});
