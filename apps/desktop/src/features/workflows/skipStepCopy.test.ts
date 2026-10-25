// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { anAgent, aWorkflowRun } from '@goodboy/types/testing';
import { skipStepDescription, skipStepTitle } from './skipStepCopy';

const REVIEW = anAgent({ name: 'Review', ordinal: 0, status: 'running' });
const IMPLEMENT = anAgent({ name: 'Implement', ordinal: 1, status: 'pending' });
const BODY =
  'Its turn is cancelled and the step is marked Skipped. Its changes stay in the worktree.';

describe('skip a workflow step: the confirmation', () => {
  it('names the step in the skip question', () => {
    expect(skipStepTitle({ agent: REVIEW })).toBe('Skip Review?');
  });

  it('says the run moves on to the next step when autorun is on', () => {
    const run = aWorkflowRun({ autoRun: true });

    expect(skipStepDescription({ run, agent: REVIEW, agents: [REVIEW, IMPLEMENT] })).toBe(
      `${BODY} The run moves on to Implement.`,
    );
  });

  it('says you choose when the next step starts when autorun is off', () => {
    const run = aWorkflowRun({ autoRun: false });

    expect(skipStepDescription({ run, agent: REVIEW, agents: [REVIEW, IMPLEMENT] })).toBe(
      `${BODY} You choose when Implement starts.`,
    );
  });

  it('says nothing starts until you resume when the run is paused', () => {
    const run = aWorkflowRun({
      autoRun: true,
      orchestrationStop: { kind: 'paused', message: 'Paused by you.' },
    });

    expect(skipStepDescription({ run, agent: REVIEW, agents: [REVIEW, IMPLEMENT] })).toBe(
      `${BODY} Nothing new starts until you resume.`,
    );
  });

  it('says it was the last step for a preset run with no step after', () => {
    const run = aWorkflowRun({ autoRun: true });

    expect(skipStepDescription({ run, agent: IMPLEMENT, agents: [REVIEW, IMPLEMENT] })).toBe(
      `${BODY} It was the last step.`,
    );
  });

  it('leaves the next move to the orchestrator for a dynamic run with no step after', () => {
    const autoRun = aWorkflowRun({ executionMode: 'dynamic', autoRun: true });
    const manual = aWorkflowRun({ executionMode: 'dynamic', autoRun: false });

    expect(skipStepDescription({ run: autoRun, agent: IMPLEMENT, agents: [IMPLEMENT] })).toBe(
      `${BODY} The orchestrator decides what comes next.`,
    );
    expect(skipStepDescription({ run: manual, agent: IMPLEMENT, agents: [IMPLEMENT] })).toBe(
      `${BODY} You choose when the orchestrator decides what comes next.`,
    );
  });
});
