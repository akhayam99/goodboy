import { describe, expect, it } from 'vitest';
import type { OpenQuestion, PullRequestState } from '@goodboy/types';
import { selectNextUp } from './selectNextUp';

const question = (text: string): OpenQuestion =>
  ({ status: 'open', text }) as unknown as OpenQuestion;

const pr = (over: Partial<PullRequestState> = {}): PullRequestState =>
  ({
    number: 123,
    title: 'ship the thing',
    state: 'open',
    isDraft: false,
    reviewDecision: null,
    ...over,
  }) as PullRequestState;

const everySignal = {
  openQuestions: [question('why this approach?\nmore detail')],
  questionBlocksRun: true,
  pr: pr({ reviewDecision: 'changes_requested' }),
  waiting: { lens: 'agents', agentId: 'agent-9', isResolver: false },
  stalledStep: { runId: 'run-7', name: 'Implement' },
  sessionStateKind: 'idle',
  isFresh: false,
  runningAgentId: 'agent-9',
  resolveCount: 2,
} as const;

describe('selectNextUp precedence', () => {
  it('1. an unanswered question wins over every other signal', () => {
    const item = selectNextUp({ ...everySignal });
    expect(item).toMatchObject({ id: 'question', action: 'Answer', lens: 'questions' });
    expect(item?.detail).toBe('why this approach?');
  });

  it('2. a pull request wanting changes wins once the questions are answered', () => {
    const item = selectNextUp({ ...everySignal, openQuestions: [] });
    expect(item).toMatchObject({ id: 'review', action: 'Review', tone: 'info', lens: 'pr' });
  });

  it('3. an agent waiting on you wins once the pull request is quiet', () => {
    const item = selectNextUp({ ...everySignal, openQuestions: [], pr: pr() });
    expect(item).toMatchObject({ id: 'resume', action: 'Resume', itemId: 'agent-9' });
  });

  it('4. a stalled step wins once nothing is waiting on a reply', () => {
    const item = selectNextUp({
      ...everySignal,
      openQuestions: [],
      pr: pr(),
      waiting: null,
    });
    expect(item).toMatchObject({
      id: 'stalled',
      action: 'Restart the step',
      tone: 'warning',
      lens: 'workflows',
      itemId: 'run-7',
    });
  });

  it('5. an unmerged pull request wins once the pipeline is clean', () => {
    const item = selectNextUp({
      ...everySignal,
      openQuestions: [],
      pr: pr(),
      waiting: null,
      stalledStep: null,
    });
    expect(item).toMatchObject({ id: 'close-out', action: 'Close it out', tone: 'success' });
  });

  it('6. a fresh session offers the first workflow', () => {
    const item = selectNextUp({
      ...everySignal,
      openQuestions: [],
      pr: null,
      waiting: null,
      stalledStep: null,
      isFresh: true,
      runningAgentId: null,
      resolveCount: 0,
    });
    expect(item).toMatchObject({ id: 'start', action: 'Start a workflow', lens: null });
  });

  it('7. a running session with nothing pending opens the most recent agent', () => {
    const item = selectNextUp({
      ...everySignal,
      openQuestions: [],
      pr: null,
      waiting: null,
      stalledStep: null,
      resolveCount: 0,
    });
    expect(item).toMatchObject({
      id: 'follow',
      action: 'Follow the run',
      lens: 'agents',
      itemId: 'agent-9',
    });
  });

  it('has nothing to propose when the session is idle and complete', () => {
    expect(
      selectNextUp({
        ...everySignal,
        openQuestions: [],
        pr: null,
        waiting: null,
        stalledStep: null,
        runningAgentId: null,
        resolveCount: 0,
      }),
    ).toBeNull();
  });
});

describe('selectNextUp tone and signals', () => {
  it('warns about a question only when it blocks a running workflow', () => {
    expect(selectNextUp({ ...everySignal })?.tone).toBe('warning');
    expect(selectNextUp({ ...everySignal, questionBlocksRun: false })?.tone).toBe('neutral');
  });

  it('keeps every other live signal in the tail of the chosen item', () => {
    expect(selectNextUp({ ...everySignal })?.signals).toEqual([
      'review',
      'resume',
      'stalled',
      'resolve',
    ]);
  });

  it('drops a signal from the tail once it is no longer live', () => {
    expect(selectNextUp({ ...everySignal, pr: pr(), stalledStep: null })?.signals).toEqual([
      'resume',
      'resolve',
    ]);
  });
});
