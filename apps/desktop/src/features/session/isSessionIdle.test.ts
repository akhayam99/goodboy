import { describe, expect, it } from 'vitest';
import { brandedId } from '../history/testing/brandedId';
import type { IsoDateTime } from '@goodboy/types';
import { anAgent, aWorkflowRun } from '@goodboy/types/testing';
import { isSessionIdle } from './isSessionIdle';

describe('isSessionIdle', () => {
  it('is idle on an empty session', () => {
    expect(isSessionIdle({ agents: [], workflowRuns: [], openQuestionCount: 0 })).toBe(true);
  });

  it('is idle when every agent and run has finished', () => {
    const run = aWorkflowRun();
    const agents = [
      anAgent({ status: 'completed', workflowRunId: run.id }),
      anAgent({ status: 'skipped' }),
      anAgent({ status: 'stopped' }),
    ];

    expect(isSessionIdle({ agents, workflowRuns: [run], openQuestionCount: 0 })).toBe(true);
  });

  it('is busy while one agent is running', () => {
    const agents = [anAgent({ status: 'completed' }), anAgent({ status: 'running' })];

    expect(isSessionIdle({ agents, workflowRuns: [], openQuestionCount: 0 })).toBe(false);
  });

  it('is busy while one agent is blocked', () => {
    const agents = [anAgent({ status: 'completed' }), anAgent({ status: 'blocked' })];

    expect(isSessionIdle({ agents, workflowRuns: [], openQuestionCount: 0 })).toBe(false);
  });

  it('is busy when an agent failed and nobody looked at it', () => {
    const agents = [anAgent({ status: 'failed' })];

    expect(isSessionIdle({ agents, workflowRuns: [], openQuestionCount: 0 })).toBe(false);
  });

  it('is busy while a question is open', () => {
    const agents = [anAgent({ status: 'completed' })];

    expect(isSessionIdle({ agents, workflowRuns: [], openQuestionCount: 1 })).toBe(false);
  });

  it('is busy while a run has no agent yet', () => {
    expect(
      isSessionIdle({ agents: [], workflowRuns: [aWorkflowRun()], openQuestionCount: 0 }),
    ).toBe(false);
  });

  it('ignores a run the user discarded', () => {
    const run = aWorkflowRun({
      discardedAt: brandedId<IsoDateTime>({ value: '2026-10-14T10:00:00.000Z' }),
    });

    expect(isSessionIdle({ agents: [], workflowRuns: [run], openQuestionCount: 0 })).toBe(true);
  });
});
