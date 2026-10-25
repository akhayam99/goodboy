import { describe, expect, it } from 'vitest';
import { AUTO_BLOCK_TEXT, AUTO_STALE_DECIDE_TEXT } from '@goodboy/core';
import { brandId, type IsoDateTime, type ProviderRunId, type TurnState } from '@goodboy/types';
import { aDelegation, aPlanRow, aView } from '../../auto/testing/autoViewFixtures';
import { agentTurnLive } from './agentTurnLive';
import { autoChildLive } from './autoChildLive';
import { autoTreeLive } from './autoTreeLive';
import type { TailFacts } from '../tailFacts';

const STARTED = brandId<IsoDateTime>({ value: '2026-10-16T09:00:00.000Z' });
const RUN = brandId<ProviderRunId>({ value: 'run-1' });
const RUNNING: TurnState = { kind: 'running', runId: RUN, startedAt: STARTED };
const BLOCKED: TurnState = { kind: 'blocked', runId: RUN, blockedAt: STARTED };
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

  it('draws no tail and no Stop for a resting tree whose answer has ended', () => {
    const idle = { kind: 'idle', lastActivityAt: STARTED } as const;
    for (const phase of ['answering', 'done', 'finished'] as const) {
      const facts = autoTreeLive({ ...base, view: aView({ phase }), rootTurn: idle });
      expect(facts?.state).toBe('idle');
      expect(facts?.phrase).not.toBe('Deciding what to do next');
      expect(idsOf(facts)).toEqual([]);
    }
  });

  it('never pauses a resting tree at the limit', () => {
    const view = aView({ phase: 'answering', spentUsd: 5, capUsd: 5 });
    expect(autoTreeLive({ ...base, view, rootTurn: null })?.state).toBe('idle');
  });

  it('says why a blocked tree stopped and offers Retry first', () => {
    const view = aView({ phase: 'blocked' });
    const blocked = {
      ...view,
      tree: { ...view.tree, blockedReason: AUTO_STALE_DECIDE_TEXT },
    };
    const facts = autoTreeLive({ ...base, view: blocked, rootTurn: null });
    expect(facts).toMatchObject({ state: 'failed', phrase: `Blocked: ${AUTO_STALE_DECIDE_TEXT}` });
    expect(idsOf(facts)).toEqual(['retry', 'viewTranscript']);
  });

  it('offers the limit or Stop, not Retry, for a tree blocked at the budget', () => {
    const view = aView({ phase: 'blocked' });
    const blocked = { ...view, tree: { ...view.tree, blockedReason: AUTO_BLOCK_TEXT.budget } };
    expect(idsOf(autoTreeLive({ ...base, view: blocked, rootTurn: null }))).toEqual([
      'raiseLimit',
      'changeLimit',
      'stopAuto',
    ]);
  });

  it('says the agents still running finish past the limit on a budget block', () => {
    const view = aView({
      phase: 'blocked',
      delegations: [
        aDelegation({ key: 'a', role: 'implementer', state: 'running' }),
        aDelegation({ key: 'b', role: 'tester', state: 'running' }),
      ],
    });
    const blocked = { ...view, tree: { ...view.tree, blockedReason: AUTO_BLOCK_TEXT.budget } };
    expect(autoTreeLive({ ...base, view: blocked, rootTurn: null })?.phrase).toBe(
      `Blocked: ${AUTO_BLOCK_TEXT.budget} No new agent starts. The 2 agents still running finish their work and can spend past the limit.`,
    );
  });

  it('names the roles Auto waits for', () => {
    const view = aView({
      phase: 'waiting',
      delegations: [aDelegation({ key: 'a', role: 'implementer', state: 'running' })],
    });
    const facts = autoTreeLive({ ...base, view, rootTurn: null });
    expect(facts).toMatchObject({ state: 'waiting', phrase: 'Waiting for Implementer' });
    expect(idsOf(facts)).toEqual(['changeApproach', 'stopAuto']);
  });

  it('says a refused hand over in the user voice while Auto chooses again', () => {
    const view = {
      ...aView({ phase: 'waiting' }),
      pendingRefusal: { action: 'delegate', code: 'mount_ambiguous', roles: ['implementer'] },
    };
    const facts = autoTreeLive({ ...base, view, rootTurn: null });
    expect(facts?.state).toBe('working');
    expect(facts?.phrase).toMatch(/^Auto tried to start an Implementer\. Not started:/);
  });

  it('leaves the tail to the plan ask while a plan waits for approval', () => {
    const view = aView({
      phase: 'waiting',
      artifacts: [aPlanRow()],
      delegations: [
        aDelegation({ key: 'planner', role: 'planner', state: 'settled', outcome: 'completed' }),
      ],
    });
    expect(autoTreeLive({ ...base, view, rootTurn: null })).toBeNull();
  });

  it('pauses at the limit with Raise limit first', () => {
    const view = aView({ phase: 'waiting', spentUsd: 4.8, reservedUsd: 0.2, capUsd: 5 });
    const facts = autoTreeLive({ ...base, view, rootTurn: null });
    expect(facts?.state).toBe('paused');
    expect(facts?.phrase).toBe('Paused at the limit: $5.00 of $5.00');
    expect(idsOf(facts)).toEqual(['raiseLimit', 'changeLimit', 'stopAuto']);
  });

  it('says the one agent still running finishes its work at the limit', () => {
    const view = aView({
      phase: 'waiting',
      spentUsd: 5,
      capUsd: 5,
      delegations: [aDelegation({ key: 'a', role: 'implementer', state: 'running' })],
    });
    expect(autoTreeLive({ ...base, view, rootTurn: null })?.phrase).toBe(
      'Paused at the limit: $5.00 of $5.00. No new agent starts. The agent still running finishes its work and can spend past the limit.',
    );
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

  it('reads Queued only for a child Auto accepted and has not started', () => {
    const facts = autoChildLive({
      delegation: { state: 'accepted', outcome: null, reason: null },
      turn: null,
      agent: IDLE_AGENT,
      lastTool: null,
      project: null,
    });
    expect(facts).toMatchObject({ state: 'queued', phrase: 'Queued' });
    expect(idsOf(facts)).toEqual(['stopAgent']);
  });

  it('reads a child that waits for your OK as needing you, with Confirm and Decline and no Stop', () => {
    const facts = autoChildLive({
      delegation: { state: 'awaiting_confirm', outcome: null, reason: null },
      turn: null,
      agent: IDLE_AGENT,
      lastTool: null,
      project: null,
    });
    expect(facts).toMatchObject({ state: 'needsYou', phrase: 'Waiting for your OK' });
    expect(idsOf(facts)).toEqual(['confirmDelegation', 'declineDelegation']);
  });

  it.each([
    { name: 'paused with its turn blocked', state: 'paused', turn: BLOCKED },
    { name: 'paused before its turn is known', state: 'paused', turn: null },
    { name: 'running with its turn blocked', state: 'running', turn: BLOCKED },
  ] as const)('reads a child that asked a question as needing you: $name', ({ state, turn }) => {
    const facts = autoChildLive({
      delegation: { state, outcome: null, reason: null },
      turn,
      agent: IDLE_AGENT,
      lastTool: null,
      project: null,
    });
    expect(facts).toMatchObject({ state: 'needsYou', phrase: 'Asked a question' });
    expect(idsOf(facts)).toEqual([]);
  });

  it('reads a child whose turn ended in an error as failed, not Queued, with Retry through Auto', () => {
    const facts = autoChildLive({
      delegation: { state: 'running', outcome: null, reason: null },
      turn: { kind: 'error', message: 'the provider exited.', failedAt: STARTED },
      agent: IDLE_AGENT,
      lastTool: null,
      project: null,
    });
    expect(facts).toMatchObject({ state: 'failed', phrase: 'Failed: the provider exited.' });
    expect(idsOf(facts)).toEqual(['retryThroughAuto']);
  });

  it('reads a started child with no turn read yet as working, with Stop agent', () => {
    const facts = autoChildLive({
      delegation: { state: 'starting', outcome: null, reason: null },
      turn: null,
      agent: IDLE_AGENT,
      lastTool: null,
      project: null,
    });
    expect(facts).toMatchObject({ state: 'working', phrase: 'Working' });
    expect(idsOf(facts)).toEqual(['stopAgent']);
  });

  it('reads a child stopped before Auto settled it as stopped, with Retry through Auto', () => {
    const facts = autoChildLive({
      delegation: { state: 'running', outcome: null, reason: null },
      turn: null,
      agent: STOPPED_AGENT,
      lastTool: null,
      project: null,
    });
    expect(facts?.state).toBe('stopped');
    expect(idsOf(facts)).toEqual(['retryThroughAuto']);
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
  it('runs no clock while a turn waits for your answer', () => {
    const facts = agentTurnLive({
      turn: { kind: 'blocked', runId: RUN, blockedAt: STARTED },
      agent: IDLE_AGENT,
      lastTool: null,
      project: null,
      hasQueuedMessage: false,
    });
    expect(facts?.phrase).toBe('Waiting for your answer');
    expect(facts?.startedAt).toBeNull();
  });
});
