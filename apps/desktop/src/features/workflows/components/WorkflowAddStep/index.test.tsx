// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { SessionId, WorkflowRunId, WorkspaceId } from '@goodboy/types';

const { addStepSpy } = vi.hoisted(() => ({
  addStepSpy: vi.fn(async () => ({ kind: 'added' as const })),
}));

const storeState = {
  addStepToWorkflowRun: addStepSpy,
  workspaceOverrides: {},
  providers: [{ id: 'anthropic', connection: 'connected' }],
};

vi.mock('../../../../store', () => ({
  useAppStore: (selector: (state: typeof storeState) => unknown) => selector(storeState),
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

beforeEach(() => {
  vi.clearAllMocks();
  addStepSpy.mockResolvedValue({ kind: 'added' as const });
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
