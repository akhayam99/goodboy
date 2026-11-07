// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { Workflow } from '@goodboy/types';
import { anAgent, aWorkflowRun } from '@goodboy/types/testing';
import { runRowFactsOf } from './runRowFactsOf';
import { runGlanceOf } from '../session/glance/runGlanceOf';
import { runStepCountOf, runStepCountWordOf } from './runStepCountOf';

const workflow: Workflow = JSON.parse('{"id":"workflow-export","steps":[]}');

describe('runStepCountOf', () => {
  it('reads 2 of 3 steps with a known total and 2 steps done with none', () => {
    expect(runStepCountWordOf({ done: 2, total: 3 })).toBe('2 of 3 steps');
    expect(runStepCountWordOf({ done: 2, total: null })).toBe('2 steps done');
    expect(runStepCountWordOf({ done: 1, total: null })).toBe('1 step done');
  });

  it('counts root steps only, so a helper never moves the number', () => {
    const root = anAgent({ status: 'completed' });
    const helper = anAgent({ status: 'completed', parentAgentId: root.id });
    const run = aWorkflowRun({ executionMode: 'dynamic' });

    expect(runStepCountOf({ run, workflow, agents: [root, helper] })).toEqual({
      done: 1,
      total: null,
    });
  });

  it('gives the glance and the Runs row the same words', () => {
    const agents = [
      anAgent({ status: 'completed', ordinal: 0 }),
      anAgent({ status: 'running', ordinal: 1 }),
    ];
    const run = aWorkflowRun({ executionMode: 'dynamic' });
    const { done } = runStepCountOf({ run, workflow, agents });
    const glance = runGlanceOf({
      isDiscarded: false,
      isCompleted: false,
      isDynamic: true,
      doneCount: done,
      stepCount: 0,
      primary: null,
    });
    const row = runRowFactsOf({
      run,
      workflow,
      agents,
      predecessorName: '',
      isOrchestrating: false,
      questions: [],
      isPlanRevising: false,
    });

    expect(row.progress).toBe('1 step done');
    expect(glance.sentence).toBe(row.progress);
  });
});
