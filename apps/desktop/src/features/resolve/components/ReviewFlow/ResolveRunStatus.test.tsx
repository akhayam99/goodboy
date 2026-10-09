// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { AgentId, ResolveAttempt, SessionId } from '@goodboy/types';
import type { ResolveWord } from '../../commentProjection';
import { fixRunOf, type FixRun } from '../../fixRun';
import { ResolveRunStatus } from './ResolveRunStatus';

afterEach(cleanup);

const ATTEMPT = {
  id: 'a1',
  sessionId: 'session-1' as SessionId,
  agentId: 'agent-1' as AgentId,
  prNumber: 318,
  threadIds: [],
  launchId: 'launch-1',
  provider: 'anthropic',
  model: 'claude-sonnet-5-5',
  effort: 'medium',
  instructions: null,
  phase: 'running',
  mountTarget: null,
  startedAt: 1,
  endedAt: null,
  error: null,
  createdAt: 1,
  batchId: null,
  copyPath: null,
  launchChoice: null,
} satisfies ResolveAttempt;

const WORDS: ReadonlyArray<ResolveWord> = [
  'to_review',
  'to_review',
  'question',
  'push_failed',
  'working',
  'working',
  'ready',
  'ready',
];

const runOf = (words: ReadonlyArray<ResolveWord>): FixRun => {
  const run = fixRunOf({
    sources: words.map((word, index) => ({
      threadId: `t${index}`,
      word,
      attempt: ATTEMPT,
    })),
  });
  if (run === null) {
    throw new Error('no run');
  }
  return run;
};

const renderStatus = ({
  words = WORDS,
  ...rest
}: {
  readonly words?: ReadonlyArray<ResolveWord>;
  readonly filter?: Parameters<typeof ResolveRunStatus>[0]['filter'];
  readonly onFilter?: () => void;
  readonly actions?: Parameters<typeof ResolveRunStatus>[0]['actions'];
}) =>
  render(
    <ResolveRunStatus
      run={runOf(words)}
      filter={rest.filter ?? null}
      onFilter={rest.onFilter ?? vi.fn()}
      onOpenTranscript={vi.fn()}
      onStop={vi.fn()}
      actions={rest.actions}
    />,
  );

describe('ResolveRunStatus', () => {
  it('reads the run as one line: title, delivery tally, model', () => {
    renderStatus({});

    const line = within(screen.getByTestId('resolve-run-status'));
    expect(line.getByText('Fixing 8 comments')).toBeDefined();
    expect(line.getByRole('button', { name: '4 need you' })).toBeDefined();
    expect(line.getByRole('button', { name: '2 working' })).toBeDefined();
    expect(line.getByRole('button', { name: '2 ready to push' })).toBeDefined();
    expect(line.getByRole('button', { name: '1 push failed' })).toBeDefined();
    expect(line.queryByRole('button', { name: /couldn't fix/ })).toBeNull();
    expect(line.getByText('Sonnet 5.5 · Medium')).toBeDefined();
  });

  it.each([
    ['push_failed', '1 push failed', 'text-danger'],
    ['couldnt_fix', "1 couldn't fix", 'text-warning'],
    ['needs_you', '3 need you', 'text-warning'],
    ['ready_to_push', '1 ready to push', 'text-success'],
    ['working', '1 working', 'text-info'],
  ] as const)('draws the %s chip in its tone when it is the filter', (key, name, tone) => {
    renderStatus({
      words: ['push_failed', 'couldnt_fix', 'question', 'ready', 'working'],
      filter: key,
    });

    expect(screen.getByRole('button', { name }).className).toContain(tone);
  });

  it("offers a Couldn't fix chip when a fix run failed", () => {
    renderStatus({ words: ['couldnt_fix', 'ready'] });

    expect(screen.getByRole('button', { name: "1 couldn't fix" })).toBeDefined();
    expect(screen.getByRole('button', { name: '1 need you' })).toBeDefined();
  });

  it('marks the active filter and clears it on a second press', () => {
    const onFilter = vi.fn();
    renderStatus({ words: ['ready', 'question'], filter: 'ready_to_push', onFilter });

    expect(
      screen.getByRole('button', { name: '1 ready to push' }).getAttribute('aria-pressed'),
    ).toBe('true');
    expect(screen.getByRole('button', { name: '1 need you' }).getAttribute('aria-pressed')).toBe(
      'false',
    );

    fireEvent.click(screen.getByRole('button', { name: '1 ready to push' }));
    fireEvent.click(screen.getByRole('button', { name: '1 need you' }));

    expect(onFilter).toHaveBeenNthCalledWith(1, null);
    expect(onFilter).toHaveBeenNthCalledWith(2, 'needs_you');
  });

  it('keeps the actions slot between the model and Open transcript', () => {
    renderStatus({
      words: ['ready'],
      actions: <button type="button">Accept 1</button>,
    });

    const names = within(screen.getByTestId('resolve-run-status'))
      .getAllByRole('button')
      .map((button) => button.textContent);
    expect(names.indexOf('Accept 1')).toBeGreaterThan(names.indexOf('1 ready to push'));
    expect(names.indexOf('Accept 1')).toBeLessThan(names.indexOf('Open transcript'));
  });

  it('offers Stop only while the run works, and asks before stopping', () => {
    const { unmount } = renderStatus({ words: ['ready', 'couldnt_fix'] });

    expect(screen.queryByRole('button', { name: 'Stop' })).toBeNull();
    expect(screen.getByText('Fix run · 2 comments')).toBeDefined();
    unmount();

    renderStatus({ words: ['working', 'ready'] });
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(screen.getByText('Stop this fix run?')).toBeDefined();
  });
});
