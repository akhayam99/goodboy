// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { AgentId, ResolveAttempt, SessionId } from '@goodboy/types';
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

const runOf = (states: ReadonlyArray<'ready' | 'needs' | 'drafting' | 'failed'>): FixRun => {
  const run = fixRunOf({
    sources: states.map((state, index) => ({
      threadId: `t${index}`,
      state,
      attempt: ATTEMPT,
    })),
  });
  if (run === null) {
    throw new Error('no run');
  }
  return run;
};

describe('ResolveRunStatus', () => {
  it('reads the run as one line: title, tally, model', () => {
    render(
      <ResolveRunStatus
        run={runOf(['ready', 'ready', 'needs', 'drafting', 'failed'])}
        filter={null}
        onFilter={vi.fn()}
        onOpenTranscript={vi.fn()}
        onStop={vi.fn()}
      />,
    );

    const line = within(screen.getByTestId('resolve-run-status'));
    expect(line.getByText('Fixing 5 comments')).toBeDefined();
    expect(line.getByRole('button', { name: '2 ready' })).toBeDefined();
    expect(line.getByRole('button', { name: '1 needs you' })).toBeDefined();
    expect(line.getByRole('button', { name: '1 working' })).toBeDefined();
    expect(line.getByRole('button', { name: "1 couldn't fix" })).toBeDefined();
    expect(line.getByText('Sonnet 5.5 · Medium')).toBeDefined();
  });

  it('marks the active filter and clears it on a second press', () => {
    const onFilter = vi.fn();
    render(
      <ResolveRunStatus
        run={runOf(['ready', 'needs'])}
        filter="ready"
        onFilter={onFilter}
        onOpenTranscript={vi.fn()}
        onStop={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: '1 ready' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(screen.getByRole('button', { name: '1 needs you' }).getAttribute('aria-pressed')).toBe(
      'false',
    );

    fireEvent.click(screen.getByRole('button', { name: '1 ready' }));
    fireEvent.click(screen.getByRole('button', { name: '1 needs you' }));

    expect(onFilter).toHaveBeenNthCalledWith(1, null);
    expect(onFilter).toHaveBeenNthCalledWith(2, 'needs_you');
  });

  it('keeps the actions slot between the model and Open transcript', () => {
    render(
      <ResolveRunStatus
        run={runOf(['ready'])}
        filter={null}
        onFilter={vi.fn()}
        onOpenTranscript={vi.fn()}
        onStop={vi.fn()}
        actions={<button type="button">Accept 1</button>}
      />,
    );

    const names = within(screen.getByTestId('resolve-run-status'))
      .getAllByRole('button')
      .map((button) => button.textContent);
    expect(names.indexOf('Accept 1')).toBeGreaterThan(names.indexOf('1 ready'));
    expect(names.indexOf('Accept 1')).toBeLessThan(names.indexOf('Open transcript'));
  });

  it('offers Stop only while the run works', () => {
    render(
      <ResolveRunStatus
        run={runOf(['ready', 'failed'])}
        filter={null}
        onFilter={vi.fn()}
        onOpenTranscript={vi.fn()}
        onStop={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Stop' })).toBeNull();
    expect(screen.getByText('Fix run · 2 comments')).toBeDefined();
  });
});
