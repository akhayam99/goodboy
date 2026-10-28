// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { AgentStatus } from '@goodboy/types';
import type { OrchestratorPhase } from '../../../workflows/orchestratorState';
import { runKindPhaseOf } from './runKindPhaseOf';

type PlanParams = {
  readonly phase: OrchestratorPhase;
  readonly agentCount?: number;
  readonly isFinished?: boolean;
};

const plan = ({ phase, agentCount = 2, isFinished = false }: PlanParams) =>
  runKindPhaseOf({ agentCount, isFinished, phase, status: null });

type LeadParams = {
  readonly status: AgentStatus | null;
};

const lead = ({ status }: LeadParams) =>
  runKindPhaseOf({ agentCount: 1, isFinished: false, phase: null, status });

describe('runKindPhaseOf for a plan run', () => {
  it('lets a run change in place before its first step', () => {
    expect(plan({ phase: 'ready-first', agentCount: 0 })).toBe('unstarted');
    expect(plan({ phase: 'failed', agentCount: 0 })).toBe('unstarted');
  });

  it.each(['deciding', 'stopping', 'automatic', 'plan-revising'] as const)(
    'keeps a run with no agent yet read-only while it is %s',
    (phase) => {
      expect(plan({ phase, agentCount: 0 })).toBe('live');
    },
  );

  it.each(['deciding', 'waiting', 'automatic', 'paused', 'needs-answer', 'paused-budget'] as const)(
    'keeps the kind read-only while the run is %s',
    (phase) => {
      expect(plan({ phase })).toBe('live');
    },
  );

  it.each(['stopped', 'failed', 'step-failed', 'blocked'] as const)(
    'offers a restart when the run is %s',
    (phase) => {
      expect(plan({ phase })).toBe('ended');
    },
  );

  it('offers a new run once the run is complete', () => {
    expect(plan({ phase: 'done', isFinished: true })).toBe('finished');
  });
});

describe('runKindPhaseOf for an agent run', () => {
  it('is read-only while the agent works', () => {
    expect(lead({ status: 'running' })).toBe('live');
    expect(lead({ status: 'pending' })).toBe('live');
  });

  it('offers a restart when the agent failed, blocked or was stopped', () => {
    expect(lead({ status: 'failed' })).toBe('ended');
    expect(lead({ status: 'blocked' })).toBe('ended');
    expect(lead({ status: 'stopped' })).toBe('ended');
  });

  it('offers a new run once the agent finished', () => {
    expect(lead({ status: 'completed' })).toBe('finished');
    expect(lead({ status: null })).toBe('finished');
  });
});
