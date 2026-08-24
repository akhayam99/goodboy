import { describe, expect, it } from 'vitest';
import type { Step, Agent, Workflow, WorkflowRunId } from '@goodboy/types';
import {
  buildStepPrompt,
  classifyWorkflowChain,
  currentStep,
  findReusableAgent,
  isWorkflowComplete,
  nextStep,
  runsForWorkflowRun,
  upcomingSteps,
} from './sequencer';

const D1: Step = {
  id: 'd1' as Step['id'],
  workflowId: 't1' as Step['workflowId'],
  ordinal: 1,
  name: 'Phase 1',
  promptPrefix: 'You are an expert.',
};

const D2: Step = {
  id: 'd2' as Step['id'],
  workflowId: 't1' as Step['workflowId'],
  ordinal: 2,
  name: 'Phase 2',
  promptPrefix: 'Now refine.',
};

const D3: Step = {
  id: 'd3' as Step['id'],
  workflowId: 't1' as Step['workflowId'],
  ordinal: 3,
  name: 'Phase 3',
  promptPrefix: 'Finalize.',
};

const TEMPLATE: Workflow = {
  id: 't1' as Workflow['id'],
  workspaceId: 'w1' as Workflow['workspaceId'],
  name: 'Test Template',
  description: 'desc',
  steps: [D1, D2, D3],
  createdAt: '2024-01-01T00:00:00.000Z' as Workflow['createdAt'],
  updatedAt: '2024-01-01T00:00:00.000Z' as Workflow['updatedAt'],
};

function makeRun(
  defId: string,
  status: Agent['status'],
  ordinal: number,
  startedAt?: string,
): Agent {
  return {
    id: `run-${defId}-${startedAt ?? '0'}` as Agent['id'],
    sessionId: 's1' as Agent['sessionId'],
    stepId: defId as Agent['stepId'],
    ordinal,
    name: `run for ${defId}`,
    status,
    ...(startedAt && { startedAt: startedAt as Agent['startedAt'] }),
  };
}

describe('nextStep', () => {
  it('returns first phase when runs empty', () => {
    expect(nextStep(TEMPLATE, [])).toBe(D1);
  });

  it('returns next incomplete phase after partial completion', () => {
    const runs = [makeRun('d1', 'completed', 1)];
    expect(nextStep(TEMPLATE, runs)).toBe(D2);
  });

  it('returns null when all phases completed', () => {
    const runs = [
      makeRun('d1', 'completed', 1),
      makeRun('d2', 'completed', 2),
      makeRun('d3', 'completed', 3),
    ];
    expect(nextStep(TEMPLATE, runs)).toBeNull();
  });

  it('skipped run advances past that phase', () => {
    const runs = [makeRun('d1', 'skipped', 1)];
    expect(nextStep(TEMPLATE, runs)).toBe(D2);
  });

  it('pending run does not count as done', () => {
    const runs = [makeRun('d1', 'pending', 1)];
    expect(nextStep(TEMPLATE, runs)).toBe(D1);
  });

  it('failed run does not count as done', () => {
    const runs = [makeRun('d1', 'failed', 1)];
    expect(nextStep(TEMPLATE, runs)).toBe(D1);
  });

  it('returns lowest-ordinal incomplete even if steps unordered', () => {
    const unordered: Workflow = { ...TEMPLATE, steps: [D3, D1, D2] };
    const runs = [makeRun('d1', 'completed', 1)];
    expect(nextStep(unordered, runs)).toBe(D2);
  });

  it('returns null with empty template (0 steps)', () => {
    const empty: Workflow = { ...TEMPLATE, steps: [] };
    expect(nextStep(empty, [])).toBeNull();
  });

  it('returns first incomplete phase when running status present', () => {
    const runs = [makeRun('d1', 'running', 1)];
    expect(nextStep(TEMPLATE, runs)).toBe(D1);
  });

  it('treats unrecognized status as non-terminal (safe default)', () => {
    const badRun = {
      ...makeRun('d1', 'unknown' as Agent['status'], 1),
    };
    expect(nextStep(TEMPLATE, [badRun])).toBe(D1);
  });
});

describe('isWorkflowComplete', () => {
  it('false for empty runs', () => {
    expect(isWorkflowComplete(TEMPLATE, [])).toBe(false);
  });

  it('false for partial completion', () => {
    const runs = [makeRun('d1', 'completed', 1), makeRun('d2', 'completed', 2)];
    expect(isWorkflowComplete(TEMPLATE, runs)).toBe(false);
  });

  it('true when all completed', () => {
    const runs = [
      makeRun('d1', 'completed', 1),
      makeRun('d2', 'completed', 2),
      makeRun('d3', 'completed', 3),
    ];
    expect(isWorkflowComplete(TEMPLATE, runs)).toBe(true);
  });

  it('true when mix of completed and skipped', () => {
    const runs = [
      makeRun('d1', 'completed', 1),
      makeRun('d2', 'skipped', 2),
      makeRun('d3', 'completed', 3),
    ];
    expect(isWorkflowComplete(TEMPLATE, runs)).toBe(true);
  });

  it('false when any run is pending', () => {
    const runs = [
      makeRun('d1', 'completed', 1),
      makeRun('d2', 'pending', 2),
      makeRun('d3', 'completed', 3),
    ];
    expect(isWorkflowComplete(TEMPLATE, runs)).toBe(false);
  });

  it('true for template with no steps', () => {
    const empty: Workflow = { ...TEMPLATE, steps: [] };
    expect(isWorkflowComplete(empty, [])).toBe(true);
  });

  it('false when one run has running status', () => {
    const runs = [
      makeRun('d1', 'completed', 1),
      makeRun('d2', 'running', 2),
      makeRun('d3', 'pending', 3),
    ];
    expect(isWorkflowComplete(TEMPLATE, runs)).toBe(false);
  });

  it('advances past completed parallel branch rows scoped to the workflow run', () => {
    const workflowRunId = 'workflow-run-parallel' as WorkflowRunId;
    const parallelTemplate: Workflow = {
      ...TEMPLATE,
      steps: [D1, D2, D3],
    };
    const rows = [
      { ...makeRun('d1', 'pending', 1), workflowRunId },
      { ...makeRun('d2', 'pending', 2), workflowRunId },
      { ...makeRun('d3', 'pending', 3), workflowRunId },
      { ...makeRun('d1', 'completed', 1, 'branch-a'), workflowRunId },
      { ...makeRun('d2', 'completed', 2, 'branch-b'), workflowRunId },
      {
        ...makeRun('d1', 'completed', 1, 'foreign'),
        workflowRunId: 'workflow-run-foreign' as WorkflowRunId,
      },
    ];
    const scopedRows = runsForWorkflowRun(rows, workflowRunId);

    expect(nextStep(parallelTemplate, scopedRows)).toBe(D3);
    expect(isWorkflowComplete(parallelTemplate, scopedRows)).toBe(false);
    expect(
      isWorkflowComplete(parallelTemplate, [
        ...scopedRows,
        { ...makeRun('d3', 'completed', 3), workflowRunId },
      ]),
    ).toBe(true);
  });
});

describe('currentStep', () => {
  it('returns first step on cold start (no runs)', () => {
    expect(currentStep(TEMPLATE, [])).toBe(D1);
  });

  it('returns the step with a running run', () => {
    const runs = [makeRun('d2', 'running', 2, '2026-01-02T00:00:00Z')];
    expect(currentStep(TEMPLATE, runs)).toBe(D2);
  });

  it('stays on a completed step until user spawns a new agent', () => {
    const runs = [makeRun('d1', 'completed', 1, '2026-01-01T00:00:00Z')];
    expect(currentStep(TEMPLATE, runs)).toBe(D1);
  });

  it('prefers a non-terminal run over a more recent completed one', () => {
    const runs = [
      makeRun('d1', 'completed', 1, '2026-01-03T00:00:00Z'),
      makeRun('d2', 'failed', 2, '2026-01-02T00:00:00Z'),
    ];
    expect(currentStep(TEMPLATE, runs)).toBe(D2);
  });

  it('picks the most recent run by startedAt when several are non-terminal', () => {
    const runs = [
      makeRun('d1', 'running', 1, '2026-01-01T00:00:00Z'),
      makeRun('d2', 'running', 2, '2026-01-02T00:00:00Z'),
    ];
    expect(currentStep(TEMPLATE, runs)).toBe(D2);
  });

  it('falls back to first step when template empty', () => {
    expect(currentStep({ ...TEMPLATE, steps: [] }, [])).toBeNull();
  });
});

describe('upcomingSteps', () => {
  it('lists every step after the first one when nothing has run', () => {
    expect(upcomingSteps(TEMPLATE, [])).toEqual([D2, D3]);
  });

  it('drops the steps that already finished', () => {
    const runs = [makeRun('d1', 'completed', 1), makeRun('d2', 'running', 2, '2024-01-01')];
    expect(upcomingSteps(TEMPLATE, runs)).toEqual([D3]);
  });

  it('returns nothing once the last step is current', () => {
    const runs = [
      makeRun('d1', 'completed', 1),
      makeRun('d2', 'completed', 2),
      makeRun('d3', 'running', 3, '2024-01-01'),
    ];
    expect(upcomingSteps(TEMPLATE, runs)).toEqual([]);
  });

  it('returns nothing for a template without steps', () => {
    expect(upcomingSteps({ ...TEMPLATE, steps: [] }, [])).toEqual([]);
  });
});

describe('findReusableAgent', () => {
  it('returns null when no run exists for the step', () => {
    expect(findReusableAgent([], 'd1' as Step['id'])).toBeNull();
  });

  it('returns the only matching run', () => {
    const run = makeRun('d1', 'idle' as Agent['status'], 1, '2026-01-01T00:00:00Z');
    expect(findReusableAgent([run], 'd1' as Step['id'])).toBe(run);
  });

  it('returns the most recently started run for the step', () => {
    const older = makeRun('d1', 'completed', 1, '2026-01-01T00:00:00Z');
    const newer = makeRun('d1', 'running', 1, '2026-01-02T00:00:00Z');
    expect(findReusableAgent([older, newer], 'd1' as Step['id'])).toBe(newer);
  });

  it('ignores runs for other steps', () => {
    const a = makeRun('d1', 'completed', 1, '2026-01-02T00:00:00Z');
    const b = makeRun('d2', 'running', 2, '2026-01-01T00:00:00Z');
    expect(findReusableAgent([a, b], 'd2' as Step['id'])).toBe(b);
  });
});

describe('buildStepPrompt', () => {
  it('concatenates all parts with double newline', () => {
    const result = buildStepPrompt({
      definition: D1,
      carryForwardContext: 'context here',
      userMessage: 'do the thing',
    });
    expect(result).toBe('You are an expert.\n\ncontext here\n\ndo the thing');
  });

  it('omits empty carryForwardContext', () => {
    const result = buildStepPrompt({
      definition: D1,
      carryForwardContext: '',
      userMessage: 'do the thing',
    });
    expect(result).toBe('You are an expert.\n\ndo the thing');
  });

  it('omits empty userMessage', () => {
    const result = buildStepPrompt({
      definition: D1,
      carryForwardContext: 'ctx',
      userMessage: '',
    });
    expect(result).toBe('You are an expert.\n\nctx');
  });

  it('omits empty promptPrefix', () => {
    const noPrefix: Step = { ...D1, promptPrefix: '' };
    const result = buildStepPrompt({
      definition: noPrefix,
      carryForwardContext: 'ctx',
      userMessage: 'msg',
    });
    expect(result).toBe('ctx\n\nmsg');
  });

  it('returns single part when only promptPrefix non-empty', () => {
    const result = buildStepPrompt({
      definition: D1,
      carryForwardContext: '',
      userMessage: '',
    });
    expect(result).toBe('You are an expert.');
  });

  it('trims whitespace-only parts', () => {
    const result = buildStepPrompt({
      definition: D1,
      carryForwardContext: '   ',
      userMessage: '\n',
    });
    expect(result).toBe('You are an expert.');
  });
});

describe('classifyWorkflowChain', () => {
  it('returns step for first pending step when no runs exist', () => {
    const chain = classifyWorkflowChain(TEMPLATE, []);
    expect(chain).toEqual({ kind: 'step', step: D1 });
  });

  it('returns step for next pending step after completed predecessor', () => {
    const runs = [makeRun('d1', 'completed', 1)];
    const chain = classifyWorkflowChain(TEMPLATE, runs);
    expect(chain).toEqual({ kind: 'step', step: D2 });
  });

  it('hops over every completed step in one go', () => {
    const runs = [makeRun('d1', 'completed', 1), makeRun('d2', 'completed', 2)];
    const chain = classifyWorkflowChain(TEMPLATE, runs);
    expect(chain).toEqual({ kind: 'step', step: D3 });
  });

  it('treats a skipped step as done and moves past it', () => {
    const runs = [makeRun('d1', 'skipped', 1)];
    const chain = classifyWorkflowChain(TEMPLATE, runs);
    expect(chain).toEqual({ kind: 'step', step: D2 });
  });

  it('returns blocked when predecessor has failed', () => {
    const runs = [makeRun('d1', 'failed', 1, '2026-01-01T00:00:00Z')];
    const chain = classifyWorkflowChain(TEMPLATE, runs);
    expect(chain.kind).toBe('blocked');
    if (chain.kind === 'blocked') {
      expect(chain.failedStep).toBe(D1);
    }
  });

  it('returns complete when all steps done', () => {
    const runs = [
      makeRun('d1', 'completed', 1),
      makeRun('d2', 'completed', 2),
      makeRun('d3', 'completed', 3),
    ];
    expect(classifyWorkflowChain(TEMPLATE, runs)).toEqual({ kind: 'complete' });
  });

  it('returns complete when mix of completed and skipped', () => {
    const runs = [
      makeRun('d1', 'completed', 1),
      makeRun('d2', 'skipped', 2),
      makeRun('d3', 'completed', 3),
    ];
    expect(classifyWorkflowChain(TEMPLATE, runs)).toEqual({ kind: 'complete' });
  });

  it('returns step (not blocked) when pending step has no agent yet', () => {
    const runs = [makeRun('d1', 'completed', 1)];
    const chain = classifyWorkflowChain(TEMPLATE, runs);
    expect(chain.kind).toBe('step');
  });

  it('returns step when pending step agent is still running', () => {
    const runs = [
      makeRun('d1', 'completed', 1),
      makeRun('d2', 'running', 2, '2026-01-02T00:00:00Z'),
    ];
    const chain = classifyWorkflowChain(TEMPLATE, runs);
    expect(chain.kind).toBe('step');
    if (chain.kind === 'step') {
      expect(chain.step).toBe(D2);
    }
  });

  it('returns complete for empty template', () => {
    const empty: Workflow = { ...TEMPLATE, steps: [] };
    expect(classifyWorkflowChain(empty, [])).toEqual({ kind: 'complete' });
  });

  it('blocked on second step when it has a failed agent', () => {
    const runs = [
      makeRun('d1', 'completed', 1),
      makeRun('d2', 'failed', 2, '2026-01-02T00:00:00Z'),
    ];
    const chain = classifyWorkflowChain(TEMPLATE, runs);
    expect(chain.kind).toBe('blocked');
    if (chain.kind === 'blocked') {
      expect(chain.failedStep).toBe(D2);
    }
  });
});
