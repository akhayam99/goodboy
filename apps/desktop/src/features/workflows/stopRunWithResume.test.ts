// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { brandId, type AgentId, type SessionId, type WorkflowRunId } from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import type { StopWorkflowRunOutcome } from '../../store/slices/workflows/stopWorkflowRunNow';
import type { ResumeState } from '../session/offerResume';
import { stopRunWithResume } from './stopRunWithResume';

const SESSION_ID = brandId<SessionId>({ value: 'session-harborline' });
const RUN_ID = brandId<WorkflowRunId>({ value: 'run-ledger-core' });
const STEP_ID = brandId<AgentId>({ value: 'step-1' });

type UndoableParams = Parameters<ResumeState['undoable']>[0];

const worldOf = (outcome: StopWorkflowRunOutcome) => {
  const offered: Array<UndoableParams> = [];
  const showToast = vi.fn();
  const state = {
    undoable: vi.fn((params: UndoableParams) => {
      offered.push(params);
      return 'undo-1';
    }),
    continueStoppedAgent: vi.fn(async () => undefined),
    stopWorkflowRunNow: vi.fn(async () => outcome),
    sessionPhaseRuns: {
      [SESSION_ID]: [
        anAgent({ id: STEP_ID, sessionId: SESSION_ID, workflowRunId: RUN_ID, status: 'running' }),
        anAgent({
          id: brandId<AgentId>({ value: 'step-0' }),
          sessionId: SESSION_ID,
          workflowRunId: RUN_ID,
          status: 'completed',
        }),
      ],
    },
  };
  return { offered, showToast, state, getState: () => state };
};

describe('stopRunWithResume', () => {
  it('stops the run at once and offers Continue for the step that was running', async () => {
    const { getState, showToast, offered, state } = worldOf('stopped');

    await stopRunWithResume({ getState, sessionId: SESSION_ID, runId: RUN_ID, showToast });
    await offered[0]?.undo();

    expect(state.stopWorkflowRunNow).toHaveBeenCalledWith(SESSION_ID, RUN_ID);
    expect(offered[0]?.actionLabel).toBe('Continue');
    expect(state.continueStoppedAgent).toHaveBeenCalledTimes(1);
    expect(state.continueStoppedAgent).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      agentId: STEP_ID,
    });
  });

  it('offers nothing while the run still runs, since the stop did not land', async () => {
    const { getState, showToast, offered } = worldOf('still_running');

    await stopRunWithResume({ getState, sessionId: SESSION_ID, runId: RUN_ID, showToast });

    expect(offered).toEqual([]);
    expect(showToast).not.toHaveBeenCalled();
  });
});
