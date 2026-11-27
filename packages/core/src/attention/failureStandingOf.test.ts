import { describe, expect, it } from 'vitest';
import {
  brandId,
  type AgentId,
  type IsoDateTime,
  type StepId,
  type WorkflowRunId,
} from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import { failureStandingOf } from './failureStandingOf';

const T = (hour: number): IsoDateTime =>
  brandId<IsoDateTime>({ value: `2026-10-06T${String(hour).padStart(2, '0')}:00:00.000Z` });

const idOf = (value: string) => brandId<AgentId>({ value });

const step = brandId<StepId>({ value: 'step-verify' });
const run = brandId<WorkflowRunId>({ value: 'run-release' });

describe('failureStandingOf', () => {
  it('keeps a failure while an unrelated agent completes', () => {
    const standing = failureStandingOf({
      agents: [
        anAgent({ id: idOf('a'), name: 'implement', status: 'failed', completedAt: T(8) }),
        anAgent({ id: idOf('b'), name: 'scout', status: 'completed', completedAt: T(9) }),
      ],
    });

    expect(standing.failures.map((failure) => failure.agentId)).toEqual([idOf('a')]);
    expect(standing.isEnded).toBe(false);
    expect(standing.failedAt).toBe(Date.parse(T(8)));
  });

  it.each(['pending', 'skipped', 'blocked', 'running'] as const)(
    'keeps a failure when a %s agent follows it',
    (status) => {
      const standing = failureStandingOf({
        agents: [
          anAgent({ id: idOf('a'), status: 'failed', completedAt: T(8) }),
          anAgent({ id: idOf('b'), ordinal: 1, status }),
        ],
      });

      expect(standing.isEnded).toBe(false);
    },
  );

  it('ends a failure when its slot was re-run and completed after it', () => {
    const standing = failureStandingOf({
      agents: [
        anAgent({
          id: idOf('a'),
          stepId: step,
          workflowRunId: run,
          status: 'failed',
          completedAt: T(8),
        }),
        anAgent({
          id: idOf('b'),
          ordinal: 1,
          stepId: step,
          workflowRunId: run,
          status: 'completed',
          completedAt: T(9),
        }),
      ],
    });

    expect(standing.isEnded).toBe(true);
    expect(standing.endedAgentIds.has(idOf('a'))).toBe(true);
  });

  it('keeps a failure when the same slot completed before it', () => {
    const standing = failureStandingOf({
      agents: [
        anAgent({ id: idOf('a'), stepId: step, status: 'failed', completedAt: T(9) }),
        anAgent({
          id: idOf('b'),
          ordinal: 1,
          stepId: step,
          status: 'completed',
          completedAt: T(8),
        }),
      ],
    });

    expect(standing.isEnded).toBe(false);
  });

  it('keeps a failure on another slot of the same run', () => {
    const standing = failureStandingOf({
      agents: [
        anAgent({ id: idOf('a'), stepId: step, workflowRunId: run, status: 'failed' }),
        anAgent({
          id: idOf('b'),
          ordinal: 1,
          stepId: brandId<StepId>({ value: 'step-other' }),
          workflowRunId: run,
          status: 'completed',
        }),
      ],
    });

    expect(standing.isEnded).toBe(false);
  });

  it('ends a failure whose delegation was replaced', () => {
    const standing = failureStandingOf({
      agents: [anAgent({ id: idOf('a'), status: 'failed', completedAt: T(8) })],
      delegations: [{ agentId: idOf('a'), isReplaced: true }],
    });

    expect(standing.isEnded).toBe(true);
  });

  it('keeps a failure whose delegation was not replaced', () => {
    const standing = failureStandingOf({
      agents: [anAgent({ id: idOf('a'), status: 'failed', completedAt: T(8) })],
      delegations: [{ agentId: idOf('a'), isReplaced: false }],
    });

    expect(standing.isEnded).toBe(false);
  });

  it('ends only the failures that predate the settle time', () => {
    const agents = [
      anAgent({ id: idOf('a'), status: 'failed', completedAt: T(8) }),
      anAgent({ id: idOf('b'), ordinal: 1, status: 'failed', completedAt: T(10) }),
    ];

    const before = failureStandingOf({ agents, settledAt: Date.parse(T(9)) });
    const after = failureStandingOf({ agents, settledAt: Date.parse(T(11)) });

    expect(before.failures.map((failure) => failure.agentId)).toEqual([idOf('b')]);
    expect(after.isEnded).toBe(true);
  });

  it('keeps a failure with no known time on a settled branch', () => {
    const standing = failureStandingOf({
      agents: [anAgent({ id: idOf('a'), status: 'failed' })],
      settledAt: Date.parse(T(9)),
    });

    expect(standing.isEnded).toBe(false);
    expect(standing.failedAt).toBeNull();
  });

  it('is not ended when no row failed', () => {
    const standing = failureStandingOf({
      agents: [anAgent({ id: idOf('a'), status: 'completed' })],
    });

    expect(standing.isEnded).toBe(false);
    expect(standing.endedAgentIds.has(idOf('a'))).toBe(true);
  });

  it('ignores a deleted agent', () => {
    const standing = failureStandingOf({
      agents: [anAgent({ id: idOf('a'), status: 'failed', deletedAt: T(9) })],
    });

    expect(standing.failures).toEqual([]);
    expect(standing.isEnded).toBe(false);
  });
});
