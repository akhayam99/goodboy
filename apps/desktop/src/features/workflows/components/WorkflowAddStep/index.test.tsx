// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type {
  ProviderId,
  RoleModelPreferences,
  SessionId,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';

const { addStepSpy } = vi.hoisted(() => ({
  addStepSpy: vi.fn(async () => ({ kind: 'added' as const })),
}));

type StoreState = {
  addStepToWorkflowRun: typeof addStepSpy;
  workspaceOverrides: Record<string, { roleModels?: RoleModelPreferences }>;
  providers: ReadonlyArray<{ id: ProviderId; connection: string }>;
  orchestratingWorkflowRuns: Record<string, boolean>;
  sessions: ReadonlyArray<Record<string, unknown>>;
};

const storeState: StoreState = {
  addStepToWorkflowRun: addStepSpy,
  workspaceOverrides: {},
  providers: [{ id: 'anthropic', connection: 'connected' }],
  orchestratingWorkflowRuns: {},
  sessions: [],
};

vi.mock('../../../../store', () => ({
  useAppStore: (selector: (state: StoreState) => unknown) => selector(storeState),
  EMPTY_ARRAY: [],
}));

import { WorkflowAddStep } from './index';

const SESSION_ID = 'ses-1' as SessionId;
const WORKSPACE_ID = 'ws-1' as WorkspaceId;
const RUN_ID = 'run-1' as WorkflowRunId;

const renderAddStep = () =>
  render(
    <WorkflowAddStep
      sessionId={SESSION_ID}
      workspaceId={WORKSPACE_ID}
      workflowRunId={RUN_ID}
      stepCount={2}
    />,
  );

type SessionParams = {
  readonly providerOverride?: ProviderId;
  readonly runRoleModels?: RoleModelPreferences;
};

const seedSession = ({ providerOverride, runRoleModels }: SessionParams = {}): void => {
  storeState.sessions = [
    {
      id: SESSION_ID,
      workspaceId: WORKSPACE_ID,
      providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
      ...(providerOverride != null && { providerOverride }),
      workflowRuns: [
        {
          id: RUN_ID,
          ...(runRoleModels != null && { roleModelOverrides: runRoleModels }),
        },
      ],
    },
  ];
};

beforeEach(() => {
  vi.clearAllMocks();
  addStepSpy.mockResolvedValue({ kind: 'added' as const });
  storeState.workspaceOverrides = {};
  storeState.providers = [
    { id: 'anthropic', connection: 'connected' },
    { id: 'codex', connection: 'connected' },
  ];
  storeState.orchestratingWorkflowRuns = {};
  seedSession();
});

afterEach(cleanup);

describe('WorkflowAddStep', () => {
  it('opens the draft inline and sends the named step to the run', async () => {
    renderAddStep();

    fireEvent.click(screen.getByRole('button', { name: /add step/i }));
    fireEvent.change(screen.getByPlaceholderText('step name'), {
      target: { value: 'Review' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add step' }));

    await waitFor(() => expect(addStepSpy).toHaveBeenCalledTimes(1));
    expect(addStepSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: SESSION_ID,
        workflowRunId: RUN_ID,
        name: 'Review',
      }),
    );
  });

  it('previews the provider the session override will spawn, not the first connected one', async () => {
    storeState.providers = [
      { id: 'anthropic', connection: 'connected' },
      { id: 'codex', connection: 'connected' },
    ];
    seedSession({ providerOverride: 'codex' });
    renderAddStep();

    fireEvent.click(screen.getByRole('button', { name: /add step/i }));

    const routing = screen.getByLabelText(/^Routing for step 3:/);
    expect(routing.getAttribute('aria-label')).toMatch(/codex/i);
  });

  it('previews the run role override ahead of the session provider', async () => {
    seedSession({
      runRoleModels: { custom: { providerId: 'codex', model: 'gpt-5.6-sol', effort: 'high' } },
    });
    renderAddStep();

    fireEvent.click(screen.getByRole('button', { name: /add step/i }));

    const routing = screen.getByLabelText(/^Routing for step 3:/);
    expect(routing.getAttribute('aria-label')).toMatch(/codex/i);
  });

  it('will not open a draft while the orchestrator is choosing the next step', () => {
    storeState.orchestratingWorkflowRuns = { [RUN_ID]: true };
    renderAddStep();

    const trigger = screen.getByRole('button', { name: /add step/i });
    expect(trigger.hasAttribute('disabled')).toBe(true);
    fireEvent.click(trigger);
    expect(screen.queryByPlaceholderText('step name')).toBeNull();
  });

  it('keeps the draft open and shows why the run refused the step', async () => {
    addStepSpy.mockResolvedValue({
      kind: 'refused',
      reason: 'this run is already finished',
    } as never);
    renderAddStep();

    fireEvent.click(screen.getByRole('button', { name: /add step/i }));
    fireEvent.change(screen.getByPlaceholderText('step name'), {
      target: { value: 'Review' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add step' }));

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe('this run is already finished'),
    );
  });
});
