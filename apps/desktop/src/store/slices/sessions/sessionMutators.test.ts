// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  brandId,
  type AgentId,
  type IsoDateTime,
  type ProviderRunId,
  type StepId,
  type TurnState,
} from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import { deriveSessionState, type AgentTurnEntry } from './sessionMutators';

const now = '2026-05-07T00:00:00.000Z' as IsoDateTime;
const earlier = '2026-05-07T00:00:01.000Z' as IsoDateTime;
const later = '2026-05-07T00:00:02.000Z' as IsoDateTime;

const idle: TurnState = { kind: 'idle', lastActivityAt: now };
const errored: TurnState = { kind: 'error', message: 'boom', failedAt: now };
const starting: TurnState = { kind: 'starting', startedAt: now };
const runA: TurnState = { kind: 'running', runId: 'run_a' as ProviderRunId, startedAt: earlier };
const runB: TurnState = { kind: 'running', runId: 'run_b' as ProviderRunId, startedAt: later };

const A = brandId<AgentId>({ value: 'agent-a' });
const B = brandId<AgentId>({ value: 'agent-b' });
const C = brandId<AgentId>({ value: 'agent-c' });
const STEP = brandId<StepId>({ value: 'step-verify' });

const entriesOf = (...states: ReadonlyArray<TurnState>): ReadonlyArray<AgentTurnEntry> =>
  states.map((state, index) => ({
    agentId: brandId<AgentId>({ value: `agent-${index}` }),
    state,
  }));

const derive = (...states: ReadonlyArray<TurnState>) =>
  deriveSessionState({ entries: entriesOf(...states), agents: [], now });

describe('deriveSessionState', () => {
  it('empty → idle', () => {
    expect(derive()).toEqual({ kind: 'idle', lastActivityAt: now });
  });

  it('all idle → idle', () => {
    expect(derive(idle, idle)).toEqual({ kind: 'idle', lastActivityAt: now });
  });

  it('any running → running (precedence over error/idle)', () => {
    expect(derive(idle, errored, runA)).toMatchObject({ kind: 'running' });
  });

  it('multiple running → representative is the latest-started run', () => {
    expect(derive(runA, runB)).toMatchObject({ kind: 'running', runId: 'run_b' });
    expect(derive(runB, runA)).toMatchObject({ kind: 'running', runId: 'run_b' });
  });

  it('starting outranks error when nothing is running', () => {
    expect(derive(errored, starting)).toEqual(starting);
  });

  it('error only when no agent is running or starting', () => {
    expect(derive(idle, errored)).toEqual(errored);
  });
});

describe('deriveSessionState with the agent rows', () => {
  const entries: ReadonlyArray<AgentTurnEntry> = [
    { agentId: A, state: errored },
    { agentId: B, state: idle },
  ];

  it('keeps the failure while an unrelated agent completed', () => {
    const agents = [
      anAgent({ id: A, status: 'failed', completedAt: earlier }),
      anAgent({ id: B, ordinal: 1, status: 'completed', completedAt: later }),
    ];

    expect(deriveSessionState({ entries, agents, now })).toEqual(errored);
  });

  it('keeps the failure while the agent row is missing', () => {
    expect(deriveSessionState({ entries, agents: [], now })).toEqual(errored);
  });

  it('keeps the failure of the agent that is being written now', () => {
    const agents = [anAgent({ id: A, status: 'completed' })];

    expect(deriveSessionState({ entries, agents, now, currentAgentId: A })).toEqual(errored);
  });

  it('drops an error when the same agent row completed', () => {
    const agents = [anAgent({ id: A, status: 'completed' })];

    expect(deriveSessionState({ entries, agents, now })).toEqual({
      kind: 'idle',
      lastActivityAt: now,
    });
  });

  it('drops an error when its slot was re-run and completed after it', () => {
    const agents = [
      anAgent({ id: A, stepId: STEP, status: 'failed', completedAt: earlier }),
      anAgent({ id: C, ordinal: 1, stepId: STEP, status: 'completed', completedAt: later }),
    ];

    expect(deriveSessionState({ entries, agents, now })).toEqual({
      kind: 'idle',
      lastActivityAt: now,
    });
  });

  it('keeps an error on a second slot when only the first was re-run', () => {
    const other = brandId<StepId>({ value: 'step-other' });
    const agents = [
      anAgent({ id: A, stepId: STEP, status: 'failed', completedAt: earlier }),
      anAgent({ id: B, ordinal: 1, stepId: other, status: 'failed', completedAt: earlier }),
      anAgent({ id: C, ordinal: 2, stepId: STEP, status: 'completed', completedAt: later }),
    ];

    expect(
      deriveSessionState({
        entries: [
          { agentId: A, state: errored },
          { agentId: B, state: errored },
        ],
        agents,
        now,
      }),
    ).toEqual(errored);
  });

  it('keeps a failure when a pending agent follows it', () => {
    const agents = [
      anAgent({ id: A, status: 'failed', completedAt: earlier }),
      anAgent({ id: B, ordinal: 1, status: 'pending' }),
    ];

    expect(deriveSessionState({ entries, agents, now })).toEqual(errored);
  });
});
