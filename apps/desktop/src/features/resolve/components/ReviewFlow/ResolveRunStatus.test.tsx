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
  readonly actions?: Parameters<typeof ResolveRunStatus>[0]['actions'];
  readonly onOpenTranscript?: Parameters<typeof ResolveRunStatus>[0]['onOpenTranscript'];
}) =>
  render(
    <ResolveRunStatus
      run={runOf(words)}
      onOpenTranscript={rest.onOpenTranscript === undefined ? vi.fn() : rest.onOpenTranscript}
      onStop={vi.fn()}
      actions={rest.actions}
    />,
  );

describe('ResolveRunStatus', () => {
  it('reads the run as one tail line, no counts and no model: the groups carry them', () => {
    renderStatus({});

    const line = within(screen.getByTestId('resolve-run-status'));
    expect(line.getByText('Fixing 8 comments')).toBeDefined();
    expect(line.queryByRole('button', { name: /need you|working|ready to push/ })).toBeNull();
    expect(line.queryByText('Sonnet 5.5 · Medium')).toBeNull();
    expect(document.querySelector('[data-tail]')).not.toBeNull();
  });

  it('keeps the actions slot before View transcript', () => {
    renderStatus({
      words: ['ready'],
      actions: <button type="button">Accept 1</button>,
    });

    const names = within(screen.getByTestId('resolve-run-status'))
      .getAllByRole('button')
      .map((button) => button.textContent);
    expect(names.indexOf('Accept 1')).toBeLessThan(names.indexOf('View transcript'));
  });

  it('drops View transcript while the transcript of the run is already open', () => {
    renderStatus({ words: ['ready'], onOpenTranscript: null });

    expect(screen.queryByRole('button', { name: 'View transcript' })).toBeNull();
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
