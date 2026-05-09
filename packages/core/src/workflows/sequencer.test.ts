import { describe, expect, it } from 'vitest';
import type { Step, Session, Workflow } from '@kay-am/types';
import { buildStepPrompt, isWorkflowComplete, nextStep } from './sequencer';

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

function makeRun(defId: string, status: Session['status'], ordinal: number): Session {
  return {
    id: `run-${defId}` as Session['id'],
    taskId: 's1' as Session['taskId'],
    stepId: defId as Session['stepId'],
    ordinal,
    name: `run for ${defId}`,
    status,
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
    // Simulate malformed DB row with unknown status
    const badRun = {
      ...makeRun('d1', 'unknown' as Session['status'], 1),
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
