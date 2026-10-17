// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { brandId, type OpenQuestionId, type WorkflowRunId } from '@goodboy/types';
import { aSession, aWorkflowRun, anAgent } from '@goodboy/types/testing';
import { agentPlace } from '../../store/slices/navigation/place';
import { runPlace } from '../workflows/runPlace';
import { openAsker } from './openAsker';

const QUESTION_ID = brandId<OpenQuestionId>({ value: 'mock-question-refund-path' });
const PRESET_RUN_ID = brandId<WorkflowRunId>({ value: 'mock-run-ledger-preset' });
const ORCHESTRATED_RUN_ID = brandId<WorkflowRunId>({ value: 'mock-run-ledger-orchestrated' });

const session = aSession({
  workflowRuns: [
    aWorkflowRun({ id: PRESET_RUN_ID, executionMode: 'static' }),
    aWorkflowRun({ id: ORCHESTRATED_RUN_ID, executionMode: 'dynamic' }),
  ],
});

const stateOf = () => ({
  sessions: [session],
  navigate: vi.fn(),
  openDrawer: vi.fn(),
  requestOpenQuestionScroll: vi.fn(),
});

describe('openAsker', () => {
  it('opens the conversation of an agent you started and scrolls to the question', () => {
    const state = stateOf();
    const asker = anAgent({ sessionId: session.id, name: 'Add the refund guard' });

    openAsker({ state, sessionId: session.id, asker, questionId: QUESTION_ID });

    expect(state.navigate).toHaveBeenCalledWith({
      to: agentPlace({ sessionId: session.id, agentId: asker.id }),
    });
    expect(state.requestOpenQuestionScroll).toHaveBeenCalledWith({
      agentId: asker.id,
      questionId: QUESTION_ID,
    });
    expect(state.openDrawer).not.toHaveBeenCalled();
  });

  it('opens the run step of a preset run that asked', () => {
    const state = stateOf();
    const asker = anAgent({ sessionId: session.id, workflowRunId: PRESET_RUN_ID });

    openAsker({ state, sessionId: session.id, asker, questionId: QUESTION_ID });

    expect(state.navigate).toHaveBeenCalledWith({
      to: runPlace({ sessionId: session.id, runId: PRESET_RUN_ID, agentId: asker.id }),
    });
    expect(state.openDrawer).not.toHaveBeenCalled();
  });

  it('opens the orchestrated run with the step that asked in the pane', () => {
    const state = stateOf();
    const asker = anAgent({ sessionId: session.id, workflowRunId: ORCHESTRATED_RUN_ID });

    openAsker({ state, sessionId: session.id, asker, questionId: QUESTION_ID });

    expect(state.navigate).toHaveBeenCalledWith({
      to: runPlace({ sessionId: session.id, runId: ORCHESTRATED_RUN_ID }),
    });
    expect(state.openDrawer).toHaveBeenCalledWith({
      kind: 'run-step',
      sessionId: session.id,
      payload: { runId: ORCHESTRATED_RUN_ID, agentId: asker.id },
    });
  });
});
