import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Session, SessionId, WorkflowRun, WorkflowRunId } from '@goodboy/types';

const { updateUserTitleSpy } = vi.hoisted(() => ({ updateUserTitleSpy: vi.fn() }));

vi.mock('@goodboy/db', () => ({ updateUserWorkflowRunTitle: updateUserTitleSpy }));
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));

import { renameWorkflowRun } from './renameWorkflowRun';

const SESSION_ID = 'session-1' as SessionId;
const RUN_ID = 'run-1' as WorkflowRunId;

const run: WorkflowRun = {
  id: RUN_ID,
  workflowId: 'wf-1' as WorkflowRun['workflowId'],
  ordinal: 0,
  currentStep: 0,
  autoRun: false,
  triggerMode: 'immediate',
  executionMode: 'static',
  title: 'Fix Safari OAuth login loop',
};

type State = { sessions: ReadonlyArray<Session> };

const buildHarness = () => {
  const state: State = {
    sessions: [{ id: SESSION_ID, workflowRuns: [run] } as unknown as Session],
  };
  const set = vi.fn((updater: (s: State) => Partial<State>) => {
    Object.assign(state, updater(state));
  });
  const rename = renameWorkflowRun(
    set as unknown as Parameters<typeof renameWorkflowRun>[0],
    (() => state) as unknown as Parameters<typeof renameWorkflowRun>[1],
  );
  const currentRun = () => state.sessions[0]?.workflowRuns[0];
  return { rename, currentRun };
};

describe('renameWorkflowRun', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('names only this run and marks the name as chosen by the user', async () => {
    updateUserTitleSpy.mockResolvedValue(undefined);
    const { rename, currentRun } = buildHarness();

    await rename(SESSION_ID, RUN_ID, '  Login loop  ');

    expect(updateUserTitleSpy).toHaveBeenCalledWith(
      expect.objectContaining({ workflowRunId: RUN_ID, title: 'Login loop' }),
    );
    expect(currentRun()).toMatchObject({ title: 'Login loop', titleUserEdited: true });
  });

  it('puts the previous title back when the write fails', async () => {
    updateUserTitleSpy.mockRejectedValue(new Error('disk full'));
    const { rename, currentRun } = buildHarness();

    await expect(rename(SESSION_ID, RUN_ID, 'Login loop')).rejects.toThrow('disk full');

    expect(currentRun()?.title).toBe('Fix Safari OAuth login loop');
    expect(currentRun()?.titleUserEdited).toBeUndefined();
  });

  it('refuses an empty name', async () => {
    const { rename } = buildHarness();

    await expect(rename(SESSION_ID, RUN_ID, '   ')).rejects.toThrow();
    expect(updateUserTitleSpy).not.toHaveBeenCalled();
  });
});
