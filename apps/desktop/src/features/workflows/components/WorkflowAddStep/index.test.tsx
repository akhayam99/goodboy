// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { aWorkflowRun } from '@goodboy/types/testing';
import { PROVIDER_CAPABILITIES } from '@goodboy/core';
import type {
  AgentId,
  ProviderId,
  SessionId,
  StepId,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';
import type { AppStore } from '../../../../store/store';
import {
  STORE_IMPORT_TIMEOUT_MS,
  buildStorySession,
  emptyOverrides,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ToastProvider } from '../../../../shared/components/Toast';
import { WorkflowAddStep } from './index';

const SESSION_ID = 'session-harborline' as SessionId;
const WORKSPACE_ID = 'workspace-harborline' as WorkspaceId;
const RUN_ID = 'run-retry' as WorkflowRunId;

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

let useAppStore: StoryStore;
const addStepToWorkflowRun = vi.fn<AppStore['addStepToWorkflowRun']>();

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

type SeedParams = {
  readonly providerOverride?: ProviderId;
};

const seed = ({ providerOverride }: SeedParams = {}) => {
  useAppStore.setState({
    sessions: [
      buildStorySession({
        id: SESSION_ID,
        workspaceId: WORKSPACE_ID,
        providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
        ...(providerOverride != null && { providerOverride }),
        workflowRuns: [aWorkflowRun({ id: RUN_ID })],
      }),
    ],
    providers: [connected('anthropic'), connected('codex')],
    addStepToWorkflowRun,
  });
};

const renderAddStep = () =>
  render(
    <ToastProvider>
      <WorkflowAddStep
        sessionId={SESSION_ID}
        workspaceId={WORKSPACE_ID}
        workflowRunId={RUN_ID}
        stepCount={2}
      />
    </ToastProvider>,
  );

const openDraft = () => fireEvent.click(screen.getByRole('button', { name: /add step/i }));

const nameStep = (name: string) =>
  fireEvent.change(screen.getByPlaceholderText('step name'), { target: { value: name } });

beforeEach(async () => {
  await resetStoryStore();
  addStepToWorkflowRun.mockReset();
  addStepToWorkflowRun.mockResolvedValue({
    kind: 'added',
    agentId: 'agent-review' as AgentId,
    stepId: 'step-review' as StepId,
  });
});

afterEach(cleanup);

describe('WorkflowAddStep', () => {
  it('opens the one step editor inline and sends the named step to the run', async () => {
    seed();
    renderAddStep();

    openDraft();
    screen.getByRole('group', { name: 'Edit step 3' });
    nameStep('Review the retry changes');
    fireEvent.click(screen.getByRole('button', { name: 'Add step' }));

    await waitFor(() =>
      expect(addStepToWorkflowRun).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: SESSION_ID,
          workflowRunId: RUN_ID,
          name: 'Review the retry changes',
        }),
      ),
    );
    expect(screen.queryByRole('group', { name: 'Edit step 3' })).toBeNull();
  });

  it('follows the provider the session override will spawn, not the first connected one', () => {
    seed({ providerOverride: 'codex' });
    renderAddStep();

    openDraft();

    expect(screen.getByTestId('step-follows-role').textContent).toMatch(/gpt/i);
  });

  it('follows the workspace role model ahead of the session provider', () => {
    seed();
    useAppStore.setState({
      workspaceOverrides: {
        [WORKSPACE_ID]: {
          ...emptyOverrides,
          roleModels: { custom: { providerId: 'codex', model: 'gpt-5.6-sol', effort: 'high' } },
        },
      },
    });
    renderAddStep();

    openDraft();

    expect(screen.getByTestId('step-follows-role').textContent).toMatch(/gpt/i);
  });

  it('will not open a draft while the orchestrator is choosing the next step', () => {
    seed();
    useAppStore.setState({ orchestratingWorkflowRuns: { [RUN_ID]: true } });
    renderAddStep();

    const trigger = screen.getByRole('button', { name: /add step/i });
    expect(trigger.hasAttribute('disabled')).toBe(true);
    fireEvent.click(trigger);
    expect(screen.queryByPlaceholderText('step name')).toBeNull();
  });

  it('discards the draft with Esc and keeps it open with the reason when the run refuses', async () => {
    seed();
    addStepToWorkflowRun.mockResolvedValue({
      kind: 'refused',
      reason: 'this run is already finished',
    });
    renderAddStep();

    openDraft();
    nameStep('Review the retry changes');
    fireEvent.click(screen.getByRole('button', { name: 'Add step' }));
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe('this run is already finished'),
    );
    fireEvent.keyDown(screen.getByPlaceholderText('step name'), { key: 'Escape' });

    expect(screen.queryByPlaceholderText('step name')).toBeNull();
    expect(addStepToWorkflowRun).toHaveBeenCalledTimes(1);
  });
});
