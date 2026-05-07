import { describe, expect, it } from 'vitest';
import type { PhaseDefinition, PhaseRun, PhaseTemplate } from '@kay-am/types';
import { buildPhasePrompt, isPhaseSequenceComplete, nextPhase } from './sequencer';

const D1: PhaseDefinition = {
  id: 'd1' as PhaseDefinition['id'],
  templateId: 't1' as PhaseDefinition['templateId'],
  ordinal: 1,
  name: 'Phase 1',
  promptPrefix: 'You are an expert.',
};

const D2: PhaseDefinition = {
  id: 'd2' as PhaseDefinition['id'],
  templateId: 't1' as PhaseDefinition['templateId'],
  ordinal: 2,
  name: 'Phase 2',
  promptPrefix: 'Now refine.',
};

const D3: PhaseDefinition = {
  id: 'd3' as PhaseDefinition['id'],
  templateId: 't1' as PhaseDefinition['templateId'],
  ordinal: 3,
  name: 'Phase 3',
  promptPrefix: 'Finalize.',
};

const TEMPLATE: PhaseTemplate = {
  id: 't1' as PhaseTemplate['id'],
  workspaceId: 'w1' as PhaseTemplate['workspaceId'],
  name: 'Test Template',
  description: 'desc',
  definitions: [D1, D2, D3],
  createdAt: '2024-01-01T00:00:00.000Z' as PhaseTemplate['createdAt'],
  updatedAt: '2024-01-01T00:00:00.000Z' as PhaseTemplate['updatedAt'],
};

function makeRun(defId: string, status: PhaseRun['status'], ordinal: number): PhaseRun {
  return {
    id: `run-${defId}` as PhaseRun['id'],
    sessionId: 's1' as PhaseRun['sessionId'],
    phaseDefinitionId: defId as PhaseRun['phaseDefinitionId'],
    ordinal,
    name: `run for ${defId}`,
    status,
  };
}

describe('nextPhase', () => {
  it('returns first phase when runs empty', () => {
    expect(nextPhase(TEMPLATE, [])).toBe(D1);
  });

  it('returns next incomplete phase after partial completion', () => {
    const runs = [makeRun('d1', 'completed', 1)];
    expect(nextPhase(TEMPLATE, runs)).toBe(D2);
  });

  it('returns null when all phases completed', () => {
    const runs = [
      makeRun('d1', 'completed', 1),
      makeRun('d2', 'completed', 2),
      makeRun('d3', 'completed', 3),
    ];
    expect(nextPhase(TEMPLATE, runs)).toBeNull();
  });

  it('skipped run advances past that phase', () => {
    const runs = [makeRun('d1', 'skipped', 1)];
    expect(nextPhase(TEMPLATE, runs)).toBe(D2);
  });

  it('pending run does not count as done', () => {
    const runs = [makeRun('d1', 'pending', 1)];
    expect(nextPhase(TEMPLATE, runs)).toBe(D1);
  });

  it('failed run does not count as done', () => {
    const runs = [makeRun('d1', 'failed', 1)];
    expect(nextPhase(TEMPLATE, runs)).toBe(D1);
  });

  it('returns lowest-ordinal incomplete even if definitions unordered', () => {
    const unordered: PhaseTemplate = { ...TEMPLATE, definitions: [D3, D1, D2] };
    const runs = [makeRun('d1', 'completed', 1)];
    expect(nextPhase(unordered, runs)).toBe(D2);
  });
});

describe('isPhaseSequenceComplete', () => {
  it('false for empty runs', () => {
    expect(isPhaseSequenceComplete(TEMPLATE, [])).toBe(false);
  });

  it('false for partial completion', () => {
    const runs = [makeRun('d1', 'completed', 1), makeRun('d2', 'completed', 2)];
    expect(isPhaseSequenceComplete(TEMPLATE, runs)).toBe(false);
  });

  it('true when all completed', () => {
    const runs = [
      makeRun('d1', 'completed', 1),
      makeRun('d2', 'completed', 2),
      makeRun('d3', 'completed', 3),
    ];
    expect(isPhaseSequenceComplete(TEMPLATE, runs)).toBe(true);
  });

  it('true when mix of completed and skipped', () => {
    const runs = [
      makeRun('d1', 'completed', 1),
      makeRun('d2', 'skipped', 2),
      makeRun('d3', 'completed', 3),
    ];
    expect(isPhaseSequenceComplete(TEMPLATE, runs)).toBe(true);
  });

  it('false when any run is pending', () => {
    const runs = [
      makeRun('d1', 'completed', 1),
      makeRun('d2', 'pending', 2),
      makeRun('d3', 'completed', 3),
    ];
    expect(isPhaseSequenceComplete(TEMPLATE, runs)).toBe(false);
  });

  it('true for template with no definitions', () => {
    const empty: PhaseTemplate = { ...TEMPLATE, definitions: [] };
    expect(isPhaseSequenceComplete(empty, [])).toBe(true);
  });
});

describe('buildPhasePrompt', () => {
  it('concatenates all parts with double newline', () => {
    const result = buildPhasePrompt({
      definition: D1,
      carryForwardContext: 'context here',
      userMessage: 'do the thing',
    });
    expect(result).toBe('You are an expert.\n\ncontext here\n\ndo the thing');
  });

  it('omits empty carryForwardContext', () => {
    const result = buildPhasePrompt({
      definition: D1,
      carryForwardContext: '',
      userMessage: 'do the thing',
    });
    expect(result).toBe('You are an expert.\n\ndo the thing');
  });

  it('omits empty userMessage', () => {
    const result = buildPhasePrompt({
      definition: D1,
      carryForwardContext: 'ctx',
      userMessage: '',
    });
    expect(result).toBe('You are an expert.\n\nctx');
  });

  it('omits empty promptPrefix', () => {
    const noPrefix: PhaseDefinition = { ...D1, promptPrefix: '' };
    const result = buildPhasePrompt({
      definition: noPrefix,
      carryForwardContext: 'ctx',
      userMessage: 'msg',
    });
    expect(result).toBe('ctx\n\nmsg');
  });

  it('returns single part when only promptPrefix non-empty', () => {
    const result = buildPhasePrompt({
      definition: D1,
      carryForwardContext: '',
      userMessage: '',
    });
    expect(result).toBe('You are an expert.');
  });

  it('trims whitespace-only parts', () => {
    const result = buildPhasePrompt({
      definition: D1,
      carryForwardContext: '   ',
      userMessage: '\n',
    });
    expect(result).toBe('You are an expert.');
  });
});
