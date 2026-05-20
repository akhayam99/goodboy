import { describe, expect, it } from 'vitest';
import type { IsoDateTime, ProviderRunId, TurnState, TurnEvent } from '@goodboy/types';
import { IllegalTurnTransitionError, turnReducer, type TurnLifecycleEvent } from './reducer';

const at = '2026-05-07T00:00:00.000Z' as IsoDateTime;
const later = '2026-05-07T00:01:00.000Z' as IsoDateTime;
const runId = 'run_1' as ProviderRunId;

const draft: TurnState = { kind: 'draft' };
const starting: TurnState = { kind: 'starting', startedAt: at };
const idle: TurnState = { kind: 'idle', lastActivityAt: at };
const running: TurnState = { kind: 'running', runId, startedAt: at };
const errored: TurnState = { kind: 'error', message: 'boom', failedAt: at };
const ended: TurnState = { kind: 'ended', endedAt: at };

describe('turnReducer — start', () => {
  it('draft → starting', () => {
    expect(turnReducer(draft, { kind: 'start', at })).toEqual({
      kind: 'starting',
      startedAt: at,
    });
  });

  it.each([starting, idle, running, errored, ended])('rejects from %s', (state) => {
    expect(() => turnReducer(state, { kind: 'start', at })).toThrow(IllegalTurnTransitionError);
  });
});

describe('turnReducer — send', () => {
  it('starting → running', () => {
    expect(turnReducer(starting, { kind: 'send', runId, at: later })).toEqual({
      kind: 'running',
      runId,
      startedAt: later,
    });
  });

  it('idle → running', () => {
    expect(turnReducer(idle, { kind: 'send', runId, at: later })).toEqual({
      kind: 'running',
      runId,
      startedAt: later,
    });
  });

  it.each([draft, running, errored, ended])('rejects from %s', (state) => {
    expect(() => turnReducer(state, { kind: 'send', runId, at })).toThrow(
      IllegalTurnTransitionError,
    );
  });
});

describe('turnReducer — receive_event', () => {
  it('done → idle', () => {
    const event: TurnEvent = { kind: 'done', runId, at: later };
    expect(turnReducer(running, { kind: 'receive_event', event })).toEqual({
      kind: 'idle',
      lastActivityAt: later,
    });
  });

  it('error → error state', () => {
    const event: TurnEvent = {
      kind: 'error',
      runId,
      message: 'rate limit',
      at: later,
    };
    expect(turnReducer(running, { kind: 'receive_event', event })).toEqual({
      kind: 'error',
      message: 'rate limit',
      failedAt: later,
    });
  });

  it.each<TurnEvent>([
    { kind: 'assistant_text', runId, delta: 'hi', at: later },
    {
      kind: 'usage',
      runId,
      usage: { inputTokens: 1, outputTokens: 1, cachedInputTokens: 0, estimatedCostUsd: 0 },
      at: later,
    },
  ])('keeps running for %s', (event) => {
    expect(turnReducer(running, { kind: 'receive_event', event })).toEqual(running);
  });

  it.each([draft, starting, idle, errored, ended])('rejects from %s', (state) => {
    const event: TurnEvent = { kind: 'done', runId, at: later };
    expect(() => turnReducer(state, { kind: 'receive_event', event })).toThrow(
      IllegalTurnTransitionError,
    );
  });
});

describe('turnReducer — end', () => {
  it.each([draft, starting, idle, running, errored])('%s → ended', (state) => {
    expect(turnReducer(state, { kind: 'end', at: later })).toEqual({
      kind: 'ended',
      endedAt: later,
    });
  });

  it('rejects from ended (already terminal)', () => {
    expect(() => turnReducer(ended, { kind: 'end', at: later })).toThrow(
      IllegalTurnTransitionError,
    );
  });
});

describe('turnReducer — error', () => {
  it.each([draft, starting, idle, running, errored])('%s → error', (state) => {
    expect(turnReducer(state, { kind: 'error', message: 'x', at: later })).toEqual({
      kind: 'error',
      message: 'x',
      failedAt: later,
    });
  });

  it('rejects from ended', () => {
    expect(() => turnReducer(ended, { kind: 'error', message: 'x', at: later })).toThrow(
      IllegalTurnTransitionError,
    );
  });
});

describe('turnReducer — retry', () => {
  it('error → idle', () => {
    expect(turnReducer(errored, { kind: 'retry', at: later })).toEqual({
      kind: 'idle',
      lastActivityAt: later,
    });
  });

  it.each([draft, starting, idle, running, ended])('rejects from %s', (state) => {
    expect(() => turnReducer(state, { kind: 'retry', at: later })).toThrow(
      IllegalTurnTransitionError,
    );
  });
});

describe('turnReducer — purity', () => {
  it('does not mutate input state', () => {
    const state: TurnState = { kind: 'draft' };
    const event: TurnLifecycleEvent = { kind: 'start', at };
    const next = turnReducer(state, event);
    expect(state).toEqual({ kind: 'draft' });
    expect(next).not.toBe(state);
  });
});
