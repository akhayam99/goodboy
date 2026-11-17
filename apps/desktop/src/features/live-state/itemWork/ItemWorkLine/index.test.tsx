import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { MeasuredTurnSpan } from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import { WorkTimeContext, type WorkTimeSource } from '../../../workTreeModel/workTimeSource';
import { ITEM_WORK_WORDS, type ItemWorkState } from '../itemWorkWords';
import { ItemWorkLine } from '.';

const NOW = Date.parse('2026-11-17T10:00:00Z');
const SECOND = 1_000;
const agent = anAgent({ status: 'running' });

const span: MeasuredTurnSpan = {
  agentId: agent.id,
  parentAgentId: null,
  agentStatus: 'running',
  workflowRunId: null,
  isOrchestratedRunDone: false,
  stepRole: 'implementer',
  provider: 'anthropic',
  model: 'claude-sonnet-5-5',
  effort: null,
  startedAtMs: NOW - 90 * SECOND,
  endedAtMs: NOW - 39 * SECOND,
  endReason: 'succeeded',
  costUsd: null,
  touchedMountIds: null,
};

type SourceParams = {
  readonly nowMs: number;
  readonly isRunning: boolean;
};

const sourceOf = ({ nowMs, isRunning }: SourceParams): WorkTimeSource => ({
  nowMs,
  spans: [span],
  history: null,
  liveStartMs: isRunning ? new Map([[agent.id, NOW - 30 * SECOND]]) : new Map(),
  childrenOf: new Map(),
});

type WithSourceParams = {
  readonly source: WorkTimeSource;
  readonly children: ReactNode;
};

const withSource = ({ source, children }: WithSourceParams) => (
  <WorkTimeContext.Provider value={source}>{children}</WorkTimeContext.Provider>
);

const clockText = (): string | null =>
  document.querySelector('[data-item-work-clock]')?.textContent ?? null;

const STATES: ReadonlyArray<ItemWorkState> = [
  'starting',
  'queued',
  'analyzing',
  'fixing',
  'resolving',
  'inRun',
  'causeFound',
  'fixReady',
  'question',
  'fixedNotPushed',
  'appliedNotPushed',
  'pushedChecking',
  'pushed',
  'fixed',
  'noFixFound',
  'stopped',
  'failed',
];

const DICTIONARY_SIZE = Object.keys(ITEM_WORK_WORDS.state).length;

afterEach(() => {
  cleanup();
});

describe('ItemWorkLine', () => {
  it('covers every word of the dictionary', () => {
    expect(STATES).toHaveLength(DICTIONARY_SIZE);
  });

  it.each(STATES)('reads %s with its dictionary word and the right live role', (state) => {
    render(<ItemWorkLine state={state} detail="The retry test expects 3 attempts" />);

    const role = state === 'failed' ? 'alert' : 'status';
    const line = screen.getByRole(role);
    expect(line.textContent).toContain(ITEM_WORK_WORDS.state[state].word);
    expect(line.textContent).toContain('The retry test expects 3 attempts');
    expect(screen.queryByRole(role === 'alert' ? 'status' : 'alert')).toBeNull();
  });

  it('keeps Stop and Open transcript in the tab order, so focus reaches them without a hover', async () => {
    const user = userEvent.setup();
    render(
      <ItemWorkLine
        state="analyzing"
        detail="Reading retryPolicy.ts"
        verbs={
          <>
            <button type="button">{ITEM_WORK_WORDS.verb.stop}</button>
            <button type="button">{ITEM_WORK_WORDS.verb.openTranscript}</button>
          </>
        }
      />,
    );

    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Stop' }));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Open transcript' }));
    expect(document.activeElement?.closest('[aria-hidden="true"]')).toBeNull();
    expect(document.activeElement?.closest('[data-item-work-verbs]')).not.toBeNull();
  });

  it('keeps the result action visible at rest', () => {
    render(
      <ItemWorkLine
        state="causeFound"
        detail="retryPolicy.ts makes 5 attempts"
        action={<button type="button">{ITEM_WORK_WORDS.verb.reviewFix}</button>}
      />,
    );

    const action = screen.getByRole('button', { name: 'Review fix' });
    expect(action.closest('[data-item-work-verbs]')).toBeNull();
  });

  it('holds the active time still while the agent waits, and moves it while it works', () => {
    const line = (
      <ItemWorkLine
        state="fixing"
        detail="Waiting for permission"
        agentId={agent.id}
        isAgentWaiting
      />
    );
    const view = render(
      withSource({ source: sourceOf({ nowMs: NOW, isRunning: false }), children: line }),
    );
    const waiting = clockText();
    expect(waiting).not.toBeNull();

    view.rerender(
      withSource({
        source: sourceOf({ nowMs: NOW + 45 * SECOND, isRunning: false }),
        children: line,
      }),
    );
    expect(clockText()).toBe(waiting);

    const working = <ItemWorkLine state="fixing" detail="Editing config.ts" agentId={agent.id} />;
    view.rerender(
      withSource({ source: sourceOf({ nowMs: NOW, isRunning: true }), children: working }),
    );
    const before = clockText();
    view.rerender(
      withSource({
        source: sourceOf({ nowMs: NOW + 45 * SECOND, isRunning: true }),
        children: working,
      }),
    );
    expect(clockText()).not.toBe(before);
  });

  it('shows no clock on a result word', () => {
    render(
      withSource({
        source: sourceOf({ nowMs: NOW, isRunning: false }),
        children: <ItemWorkLine state="fixed" detail="4f21c8b pushed" agentId={agent.id} />,
      }),
    );

    expect(clockText()).toBeNull();
  });
});
