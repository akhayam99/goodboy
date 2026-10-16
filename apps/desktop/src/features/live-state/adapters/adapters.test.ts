import { describe, expect, it } from 'vitest';
import { brandId, type IsoDateTime, type ProviderRunId, type TurnState } from '@goodboy/types';
import { aDelegation, aView } from '../../auto/testing/autoViewFixtures';
import { agentTurnLive } from './agentTurnLive';
import { autoChildLive } from './autoChildLive';
import { autoTreeLive } from './autoTreeLive';
import { checkFixLive } from './checkFixLive';
import { cleanupLive } from './cleanupLive';
import { draftStartLive } from './draftStartLive';
import { fixRunLive } from './fixRunLive';
import { historyRewriteLive } from './historyRewriteLive';
import { processStopLive } from './processStopLive';
import { workflowRunLive } from './workflowRunLive';
import type { TailFacts } from '../tailFacts';

const STARTED = brandId<IsoDateTime>({ value: '2026-10-16T09:00:00.000Z' });
const RUN = brandId<ProviderRunId>({ value: 'run-1' });
const RUNNING: TurnState = { kind: 'running', runId: RUN, startedAt: STARTED };
const IDLE_AGENT = { status: 'running', stoppedBy: undefined, stoppedAt: undefined } as const;
const STOPPED_AGENT = { status: 'stopped', stoppedBy: 'you', stoppedAt: undefined } as const;
const BASH = { name: 'Bash', command: 'CI=1 pnpm test --filter ledger-core', path: null };

const idsOf = (facts: TailFacts | null) => facts?.actions.map((action) => action.id);

describe('agentTurnLive', () => {
  it('reads the running turn: phrase from the last tool, clock from the turn start, Stop', () => {
    const facts = agentTurnLive({
      turn: RUNNING,
      agent: IDLE_AGENT,
      lastTool: BASH,
      project: 'payments-api',
      hasQueuedMessage: false,
    });
    expect(facts).toEqual({
      state: 'working',
      phrase: 'Running pnpm in payments-api',
      startedAt: STARTED,
      actions: [{ id: 'stop', label: 'Stop' }],
    });
  });

  it('marks a message sent during the turn as queued', () => {
    const facts = agentTurnLive({
      turn: RUNNING,
      agent: IDLE_AGENT,
      lastTool: null,
      project: null,
      hasQueuedMessage: true,
    });
    expect(facts?.state).toBe('queued');
    expect(facts?.phrase).toBe('Writing the answer');
  });

  it('turns an error into a failed tail with Retry, never a working one', () => {
    const facts = agentTurnLive({
      turn: {
        kind: 'error',
        message: 'the provider exited without a response.',
        failedAt: STARTED,
      },
      agent: IDLE_AGENT,
      lastTool: null,
      project: null,
      hasQueuedMessage: false,
    });
    expect(facts?.state).toBe('failed');
    expect(facts?.phrase).toBe('Failed: the provider exited without a response.');
    expect(idsOf(facts)).toEqual(['retry', 'viewTranscript']);
  });

  it('says who stopped an agent and offers Continue', () => {
    const facts = agentTurnLive({
      turn: null,
      agent: STOPPED_AGENT,
      lastTool: null,
      project: null,
      hasQueuedMessage: false,
    });
    expect(facts?.phrase).toBe('Stopped by you');
    expect(idsOf(facts)).toEqual(['continue']);
  });

  it('draws nothing for an idle agent: a finished turn is read from its summary', () => {
    expect(
      agentTurnLive({
        turn: { kind: 'idle', lastActivityAt: STARTED },
        agent: IDLE_AGENT,
        lastTool: null,
        project: null,
        hasQueuedMessage: false,
      }),
    ).toBeNull();
  });
});

describe('autoTreeLive', () => {
  const base = { rootAgent: IDLE_AGENT, lastTool: null, project: null };

  it('says Deciding what to do next while Auto decides with no turn running', () => {
    const facts = autoTreeLive({ ...base, view: aView({ phase: 'deciding' }), rootTurn: null });
    expect(facts?.phrase).toBe('Deciding what to do next');
    expect(idsOf(facts)).toEqual(['stopAuto']);
  });

  it('names the roles Auto waits for', () => {
    const view = aView({
      phase: 'waiting',
      delegations: [aDelegation({ key: 'a', role: 'implementer', state: 'running' })],
    });
    const facts = autoTreeLive({ ...base, view, rootTurn: null });
    expect(facts).toMatchObject({ state: 'waiting', phrase: 'Waiting for Implementer' });
  });

  it('pauses at the limit with Raise limit first', () => {
    const view = aView({ phase: 'waiting', spentUsd: 4.8, reservedUsd: 0.2, capUsd: 5 });
    const facts = autoTreeLive({ ...base, view, rootTurn: null });
    expect(facts?.state).toBe('paused');
    expect(facts?.phrase).toBe('Paused at the limit: $5.00 of $5.00');
    expect(idsOf(facts)).toEqual(['raiseLimit', 'changeLimit']);
  });

  it('never pauses a tree that has no limit', () => {
    const view = {
      ...aView({ phase: 'waiting' }),
      budget: { capUsd: null, spentUsd: 9, reservedUsd: 1, remainingUsd: null, hasEstimate: false },
    };
    const facts = autoTreeLive({ ...base, view, rootTurn: null });
    expect(facts?.state).not.toBe('paused');
  });

  it('lets the root turn speak while it runs, with the Auto stop', () => {
    const facts = autoTreeLive({ ...base, view: aView({ phase: 'answering' }), rootTurn: RUNNING });
    expect(facts?.startedAt).toBe(STARTED);
    expect(idsOf(facts)).toEqual(['stopAuto']);
  });

  it('offers no Stop while stopping', () => {
    const facts = autoTreeLive({ ...base, view: aView({ phase: 'stopping' }), rootTurn: null });
    expect(facts).toMatchObject({ phrase: 'Stopping', actions: [] });
  });
});

describe('autoChildLive', () => {
  it('reads Stopped with Retry through Auto for a stopped child, never Continue', () => {
    const facts = autoChildLive({
      delegation: { state: 'settled', outcome: 'stopped', reason: null },
      turn: RUNNING,
      agent: IDLE_AGENT,
      lastTool: null,
      project: null,
    });
    expect(facts?.phrase).toBe('Stopped');
    expect(idsOf(facts)).toEqual(['retryThroughAuto']);
  });

  it('stops a running child with Stop agent', () => {
    const facts = autoChildLive({
      delegation: { state: 'running', outcome: null, reason: null },
      turn: RUNNING,
      agent: IDLE_AGENT,
      lastTool: null,
      project: null,
    });
    expect(idsOf(facts)).toEqual(['stopAgent']);
  });

  it('draws nothing for a completed child', () => {
    expect(
      autoChildLive({
        delegation: { state: 'settled', outcome: 'completed', reason: null },
        turn: null,
        agent: IDLE_AGENT,
        lastTool: null,
        project: null,
      }),
    ).toBeNull();
  });
});

describe('operation adapters', () => {
  it('names the run step and its role', () => {
    const facts = workflowRunLive({
      status: 'running',
      stepNumber: 3,
      stepCount: 4,
      roleNoun: 'Tester',
      stepStartedAt: STARTED,
      failure: null,
    });
    expect(facts?.phrase).toBe('Step 3 of 4 · Tester is working');
    expect(idsOf(facts)).toEqual(['stopStep']);
  });

  it('names the check a CI fix works on', () => {
    const facts = checkFixLive({
      checkName: 'test (payments-api)',
      turn: RUNNING,
      agent: IDLE_AGENT,
      lastTool: BASH,
      project: 'payments-api',
    });
    expect(facts?.phrase).toBe('Fixing test (payments-api): running pnpm in payments-api');
  });

  it('keeps the fix run lane line and drops the done words', () => {
    expect(
      fixRunLive({ word: 'working', laneLine: 'Fixing 1 of 2', startedAt: STARTED })?.phrase,
    ).toBe('Fixing 1 of 2');
    expect(fixRunLive({ word: 'done', laneLine: null, startedAt: null })).toBeNull();
  });

  it('shows one pending state for a worktree close, then the reason and Retry', () => {
    expect(
      cleanupLive({ project: 'payments-api', isClosing: true, startedAt: null, failure: null }),
    ).toMatchObject({ phrase: 'Closing the payments-api worktree', actions: [] });
    const failed = cleanupLive({
      project: 'payments-api',
      isClosing: false,
      startedAt: null,
      failure: '2 uncommitted files.',
    });
    expect(failed?.phrase).toBe('Could not close: 2 uncommitted files.');
    expect(idsOf(failed)).toEqual(['retry']);
  });

  it('keeps the draft and offers Retry when the start fails', () => {
    expect(
      idsOf(draftStartLive({ isStarting: false, startError: 'no provider connected' })),
    ).toEqual(['retry']);
    expect(draftStartLive({ isStarting: false, startError: null })).toBeNull();
  });

  it('offers Force stop only after a stop timed out', () => {
    expect(
      processStopLive({ name: 'pnpm dev', isStopping: true, hasTimedOut: false, failure: null })
        ?.phrase,
    ).toBe('Stopping pnpm dev');
    expect(
      idsOf(
        processStopLive({ name: 'pnpm dev', isStopping: false, hasTimedOut: true, failure: null }),
      ),
    ).toEqual(['forceStop']);
  });

  it('reads the history rewrite phase', () => {
    expect(
      historyRewriteLive({ phase: 'applying', startedAt: STARTED, failure: null })?.phrase,
    ).toBe('Rewriting the history');
    expect(historyRewriteLive({ phase: 'idle', startedAt: null, failure: null })).toBeNull();
  });
});
