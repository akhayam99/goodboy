// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { aDelegation, aPlanRow, aView } from '../testing/autoViewFixtures';
import { autoDockStopOf } from './autoDockStopOf';

const ROOT = { status: 'running', stoppedBy: undefined, stoppedAt: undefined } as const;

describe('autoDockStopOf', () => {
  it('keeps the stop in the live line at the limit, with no running sentence of its own', () => {
    const view = aView({
      phase: 'waiting',
      spentUsd: 10,
      capUsd: 10,
      delegations: [aDelegation({ key: 'impl', role: 'implementer', state: 'running' })],
    });

    const stop = autoDockStopOf({
      view,
      rootTurn: null,
      rootAgent: ROOT,
      isStopping: false,
      stop: vi.fn(),
    });

    expect(stop).toMatchObject({ label: 'Stop run', phase: 'idle', sentence: '' });
  });

  it('offers the stop of a plan that waits while a sibling agent runs', () => {
    const view = aView({
      phase: 'waiting',
      artifacts: [aPlanRow()],
      delegations: [aDelegation({ key: 'impl', role: 'implementer', state: 'running' })],
    });

    const stop = autoDockStopOf({
      view,
      rootTurn: null,
      rootAgent: ROOT,
      isStopping: false,
      stop: vi.fn(),
    });

    expect(stop?.label).toBe('Stop run');
  });

  it('names the run it stops, the Lead and its agents together', () => {
    const view = aView({
      phase: 'waiting',
      delegations: [
        aDelegation({ key: 'impl', role: 'implementer', state: 'running' }),
        aDelegation({ key: 'test', role: 'tester', state: 'running' }),
      ],
    });

    const stop = autoDockStopOf({
      view,
      rootTurn: null,
      rootAgent: ROOT,
      isStopping: false,
      stop: vi.fn(),
    });

    expect(stop?.label).toBe('Stop run');
  });

  it('offers none for a tree that rests', () => {
    expect(
      autoDockStopOf({
        view: aView({ phase: 'done' }),
        rootTurn: null,
        rootAgent: ROOT,
        isStopping: false,
        stop: vi.fn(),
      }),
    ).toBeNull();
  });
});
