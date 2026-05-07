import { describe, expect, it } from 'vitest';
import type { IsoDateTime, ProviderRunId, SessionState, TurnEvent } from '@kay-am/types';
import { IllegalSessionTransitionError, sessionReducer, type SessionEvent } from './reducer';

const at = '2026-05-07T00:00:00.000Z' as IsoDateTime;
const later = '2026-05-07T00:01:00.000Z' as IsoDateTime;
const runId = 'run_1' as ProviderRunId;

const draft: SessionState = { kind: 'draft' };
const starting: SessionState = { kind: 'starting', startedAt: at };
const idle: SessionState = { kind: 'idle', lastActivityAt: at };
const running: SessionState = { kind: 'running', runId, startedAt: at };
const errored: SessionState = { kind: 'error', message: 'boom', failedAt: at };
const ended: SessionState = { kind: 'ended', endedAt: at };

describe('sessionReducer — start', () => {
  it('draft → starting', () => {
    expect(sessionReducer(draft, { kind: 'start', at })).toEqual({
      kind: 'starting',
      startedAt: at,
    });
  });

  it.each([starting, idle, running, errored, ended])('rejects from %s', (state) => {
    expect(() => sessionReducer(state, { kind: 'start', at })).toThrow(
      IllegalSessionTransitionError,
    );
  });
});

describe('sessionReducer — send', () => {
  it('starting → running', () => {
    expect(sessionReducer(starting, { kind: 'send', runId, at: later })).toEqual({
      kind: 'running',
      runId,
      startedAt: later,
    });
  });

  it('idle → running', () => {
    expect(sessionReducer(idle, { kind: 'send', runId, at: later })).toEqual({
      kind: 'running',
      runId,
      startedAt: later,
    });
  });

  it.each([draft, running, errored, ended])('rejects from %s', (state) => {
    expect(() => sessionReducer(state, { kind: 'send', runId, at })).toThrow(
      IllegalSessionTransitionError,
    );
  });
});

describe('sessionReducer — receive_event', () => {
  it('done → idle', () => {
    const event: TurnEvent = { kind: 'done', runId, at: later };
    expect(sessionReducer(running, { kind: 'receive_event', event })).toEqual({
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
    expect(sessionReducer(running, { kind: 'receive_event', event })).toEqual({
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
    expect(sessionReducer(running, { kind: 'receive_event', event })).toEqual(running);
  });

  it.each([draft, starting, idle, errored, ended])('rejects from %s', (state) => {
    const event: TurnEvent = { kind: 'done', runId, at: later };
    expect(() => sessionReducer(state, { kind: 'receive_event', event })).toThrow(
      IllegalSessionTransitionError,
    );
  });
});

describe('sessionReducer — end', () => {
  it.each([draft, starting, idle, running, errored])('%s → ended', (state) => {
    expect(sessionReducer(state, { kind: 'end', at: later })).toEqual({
      kind: 'ended',
      endedAt: later,
    });
  });

  it('rejects from ended (already terminal)', () => {
    expect(() => sessionReducer(ended, { kind: 'end', at: later })).toThrow(
      IllegalSessionTransitionError,
    );
  });
});

describe('sessionReducer — error', () => {
  it.each([draft, starting, idle, running, errored])('%s → error', (state) => {
    expect(sessionReducer(state, { kind: 'error', message: 'x', at: later })).toEqual({
      kind: 'error',
      message: 'x',
      failedAt: later,
    });
  });

  it('rejects from ended', () => {
    expect(() => sessionReducer(ended, { kind: 'error', message: 'x', at: later })).toThrow(
      IllegalSessionTransitionError,
    );
  });
});

describe('sessionReducer — retry', () => {
  it('error → idle', () => {
    expect(sessionReducer(errored, { kind: 'retry', at: later })).toEqual({
      kind: 'idle',
      lastActivityAt: later,
    });
  });

  it.each([draft, starting, idle, running, ended])('rejects from %s', (state) => {
    expect(() => sessionReducer(state, { kind: 'retry', at: later })).toThrow(
      IllegalSessionTransitionError,
    );
  });
});

describe('sessionReducer — purity', () => {
  it('does not mutate input state', () => {
    const state: SessionState = { kind: 'draft' };
    const event: SessionEvent = { kind: 'start', at };
    const next = sessionReducer(state, event);
    expect(state).toEqual({ kind: 'draft' });
    expect(next).not.toBe(state);
  });
});
