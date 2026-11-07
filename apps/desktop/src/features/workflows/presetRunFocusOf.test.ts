// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { AgentId, StepId, WorkflowRunId } from '@goodboy/types';
import { aWorkflowRun, anAgent } from '@goodboy/types/testing';
import { presetRunFocusOf } from './presetRunFocusOf';

const PRESET: WorkflowRunId = JSON.parse('"run-preset"');
const ORCHESTRATED: WorkflowRunId = JSON.parse('"run-orchestrated"');
const STEP: AgentId = JSON.parse('"agent-step"');
const CHILD: AgentId = JSON.parse('"agent-child"');
const LOOSE: AgentId = JSON.parse('"agent-loose"');
const ORCHESTRATED_STEP: AgentId = JSON.parse('"agent-orchestrated-step"');
const ORCHESTRATED_HELPER: AgentId = JSON.parse('"agent-orchestrated-helper"');
const ORCHESTRATED_STEP_ID: StepId = JSON.parse('"step-orchestrated"');

const RUNS = [
  aWorkflowRun({ id: PRESET, executionMode: 'static' }),
  aWorkflowRun({ id: ORCHESTRATED, executionMode: 'dynamic' }),
];

const AGENTS = [
  anAgent({ id: STEP, workflowRunId: PRESET }),
  anAgent({ id: CHILD, parentAgentId: STEP }),
  anAgent({ id: LOOSE }),
  anAgent({ id: ORCHESTRATED_STEP, workflowRunId: ORCHESTRATED, stepId: ORCHESTRATED_STEP_ID }),
  anAgent({ id: ORCHESTRATED_HELPER, workflowRunId: ORCHESTRATED }),
];

type FocusParams = {
  readonly lens?: string | null;
  readonly focusedRunId?: string | null;
  readonly selectedAgentId?: AgentId | null;
};

const focusOf = ({ lens = null, focusedRunId = null, selectedAgentId = null }: FocusParams) =>
  presetRunFocusOf({ lens, focusedRunId, selectedAgentId, runs: RUNS, agents: AGENTS });

describe('presetRunFocusOf', () => {
  it('drills into a preset run focused on the Runs page, on its Overview', () => {
    expect(focusOf({ lens: 'workflows', focusedRunId: PRESET })).toEqual({
      runId: PRESET,
      agentId: null,
    });
  });

  it('lands any link to a step, or a sub agent of a step, on the run level', () => {
    expect(focusOf({ selectedAgentId: STEP })).toEqual({ runId: PRESET, agentId: STEP });
    expect(focusOf({ selectedAgentId: CHILD })).toEqual({ runId: PRESET, agentId: CHILD });
  });

  it('lands a step of an orchestrated run on the same step page', () => {
    expect(focusOf({ selectedAgentId: ORCHESTRATED_STEP })).toEqual({
      runId: ORCHESTRATED,
      agentId: ORCHESTRATED_STEP,
    });
  });

  it('leaves the orchestrated overview, a loose agent and another lens alone', () => {
    expect(focusOf({ lens: 'workflows', focusedRunId: ORCHESTRATED })).toBeNull();
    expect(focusOf({ selectedAgentId: ORCHESTRATED_HELPER })).toBeNull();
    expect(focusOf({ selectedAgentId: LOOSE })).toBeNull();
    expect(focusOf({ lens: 'agents', focusedRunId: PRESET })).toBeNull();
  });
});
