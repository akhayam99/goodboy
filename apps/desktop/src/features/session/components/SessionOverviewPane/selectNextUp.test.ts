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
    checks: 'success',
    reviewDecision: 'approved',
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
  runningAgent: { lens: 'agents', itemId: 'agent-9' },
  resolveCount: 2,
  pendingResolutions: 0,
  upcomingStep: null,
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

  it('2b. a pull request whose CI failed names the failure instead of the review', () => {
    const item = selectNextUp({
      ...everySignal,
      openQuestions: [],
      pr: pr({ checks: 'failure', reviewDecision: null }),
    });
    expect(item).toMatchObject({ id: 'checks', lens: 'pr', tone: 'danger' });
    expect(item?.title).toBe('CI failed on PR #123');
  });

  it('3. an agent waiting on you wins once the pull request is quiet', () => {
    const item = selectNextUp({ ...everySignal, openQuestions: [], pr: pr() });
    expect(item).toMatchObject({ id: 'resume', action: 'Resume', itemId: 'agent-9' });
  });

  it('3b. active resolvers win once nothing is waiting on a reply', () => {
    const item = selectNextUp({
      ...everySignal,
      openQuestions: [],
      pr: pr(),
      waiting: null,
    });
    expect(item).toMatchObject({ id: 'resolve', action: 'Open the resolvers', lens: 'resolve' });
    expect(item?.title).toBe('2 active resolvers');
  });

  it('3c. queued-but-unpushed resolutions win once no resolver is active', () => {
    const item = selectNextUp({
      ...everySignal,
      openQuestions: [],
      pr: pr(),
      waiting: null,
      resolveCount: 0,
      pendingResolutions: 3,
    });
    expect(item).toMatchObject({ id: 'pending-push', action: 'Resolve', lens: 'resolve' });
    expect(item?.title).toBe('3 resolutions ready to push');
  });

  it('4. a stalled step wins once the resolve backlog is empty', () => {
    const item = selectNextUp({
      ...everySignal,
      openQuestions: [],
      pr: pr(),
      waiting: null,
      resolveCount: 0,
    });
    expect(item).toMatchObject({
      id: 'stalled',
      action: 'Restart the step',
      tone: 'warning',
      lens: 'workflows',
      itemId: 'run-7',
    });
  });

  it('4b. an errored session is caught by the same rule when no step stalled', () => {
    const item = selectNextUp({
      ...everySignal,
      openQuestions: [],
      pr: pr(),
      waiting: null,
      resolveCount: 0,
      stalledStep: null,
      sessionStateKind: 'error',
      runningAgent: null,
    });
    expect(item).toMatchObject({ id: 'errored', tone: 'danger', lens: 'agents' });
    expect(item?.title).toBe('The session errored');
  });

  it('5. an unmerged pull request wins once the pipeline is clean', () => {
    const item = selectNextUp({
      ...everySignal,
      openQuestions: [],
      pr: pr(),
      waiting: null,
      stalledStep: null,
      resolveCount: 0,
      runningAgent: null,
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
      runningAgent: null,
      resolveCount: 0,
    });
    expect(item).toMatchObject({ id: 'start', action: 'Start a workflow', lens: null });
  });

  it('7. a running session with nothing pending opens the running agent where it lives', () => {
    const item = selectNextUp({
      ...everySignal,
      openQuestions: [],
      pr: null,
      waiting: null,
      stalledStep: null,
      resolveCount: 0,
      runningAgent: { lens: 'workflows', itemId: 'run-7' },
    });
    expect(item).toMatchObject({
      id: 'follow',
      action: 'Follow the run',
      lens: 'workflows',
      itemId: 'run-7',
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
        runningAgent: null,
        resolveCount: 0,
      }),
    ).toBeNull();
  });
});

describe('selectNextUp close-out honesty', () => {
  const closeable = {
    ...everySignal,
    openQuestions: [],
    pr: pr(),
    waiting: null,
    stalledStep: null,
    resolveCount: 0,
    runningAgent: null,
  } as const;

  it('never calls a pull request done while its CI is failing', () => {
    const item = selectNextUp({ ...closeable, pr: pr({ checks: 'failure' }) });
    expect(item?.id).toBe('checks');
  });

  it('never calls a pull request done while a required review is missing', () => {
    const item = selectNextUp({ ...closeable, pr: pr({ reviewDecision: 'review_required' }) });
    expect(item).toBeNull();
  });

  it('never calls a pull request done while a workflow agent is still running', () => {
    const item = selectNextUp({
      ...closeable,
      runningAgent: { lens: 'workflows', itemId: 'run-7' },
    });
    expect(item).toMatchObject({ id: 'follow', lens: 'workflows' });
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

  it('carries a failing CI and an errored session in the tail', () => {
    expect(
      selectNextUp({
        ...everySignal,
        pr: pr({ checks: 'failure', reviewDecision: null }),
        waiting: null,
        stalledStep: null,
        sessionStateKind: 'error',
      })?.signals,
    ).toEqual(['checks', 'errored', 'resolve']);
  });
});
