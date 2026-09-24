// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ResolveAttempt, SessionId } from '@goodboy/types';

const SESSION_ID = 'session-1' as SessionId;

const h = vi.hoisted(() => {
  const state = {
    sessionPhaseRuns: {} as Record<string, ReadonlyArray<unknown>>,
    agentTurnState: {} as Record<string, unknown>,
  };
  const useAppStore = Object.assign(<T,>(selector: (s: typeof state) => T) => selector(state), {
    getState: () => state,
  });
  return { state, useAppStore, transcript: [] as ReadonlyArray<unknown> };
});

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  useAppStore: h.useAppStore,
}));
vi.mock('../../../../store/transcript', () => ({
  useTranscript: () => h.transcript,
}));
vi.mock('../../../chat/utils/transcript-items', () => ({
  reduceTranscript: (items: ReadonlyArray<unknown>) => items,
}));

import { ResolveAgentActivity } from './index';

const ATTEMPT = {
  id: 'attempt-1',
  sessionId: SESSION_ID,
  agentId: 'agent-7',
  prNumber: 264,
  threadIds: ['t-parser'],
  provider: 'anthropic',
  model: 'claude-opus-5',
  effort: null,
  instructions: null,
  phase: 'running',
  mountTarget: null,
  startedAt: 1,
  endedAt: null,
  error: null,
  createdAt: 1,
} as unknown as ResolveAttempt;

const renderActivity = (
  overrides: Partial<Parameters<typeof ResolveAgentActivity>[0]> = {},
): ReturnType<typeof render> =>
  render(
    <ResolveAgentActivity
      sessionId={SESSION_ID}
      attempt={ATTEMPT}
      costUsd={null}
      runThreadCount={1}
      isViewActionShown
      onViewAgent={vi.fn()}
      onStop={vi.fn()}
      {...overrides}
    />,
  );

afterEach(() => {
  cleanup();
  h.transcript = [];
  h.state.sessionPhaseRuns = {};
  h.state.agentTurnState = {};
});

describe('the agent activity a comment shows without leaving it', () => {
  it('says the run is working and admits it knows no cost', () => {
    renderActivity();

    expect(screen.getByText('Working')).toBeTruthy();
    expect(screen.getByText('Cost unavailable')).toBeTruthy();
  });

  it('names the provider and model the way the rest of the app does', () => {
    renderActivity();

    expect(screen.getByText('Claude')).toBeTruthy();
    expect(screen.queryByText('anthropic')).toBeNull();
    expect(screen.queryByText('claude-opus-5')).toBeNull();
  });

  it('says the run is waiting on you when the turn is blocked', () => {
    h.state.agentTurnState = { 'agent-7': { kind: 'blocked' } };

    renderActivity();

    expect(screen.getByText('Waiting on you')).toBeTruthy();
  });

  it('previews the last reply, at most three lines', () => {
    h.transcript = [
      { kind: 'assistant_text', text: 'first' },
      { kind: 'assistant_text', text: 'one\ntwo\nthree\nfour' },
    ];

    renderActivity();

    const preview = screen.getByText(/one/);
    expect(preview.textContent).toBe('one\ntwo\nthree');
  });

  it('falls back to the recorded summary when no transcript is cached', () => {
    h.state.sessionPhaseRuns = {
      [SESSION_ID]: [{ id: 'agent-7', outputSummary: 'Removed the duplicate tokens' }],
    };

    renderActivity();

    expect(screen.getByText('Removed the duplicate tokens')).toBeTruthy();
  });

  it('says a cost covers every comment of a shared run', () => {
    renderActivity({ costUsd: 0.42, runThreadCount: 3 });

    expect(screen.getByText(/shared across 3 comments/)).toBeTruthy();
  });

  it('offers the agent only when the header does not already', () => {
    const onViewAgent = vi.fn();
    renderActivity({ onViewAgent });
    fireEvent.click(screen.getByRole('button', { name: 'View agent' }));
    cleanup();
    renderActivity({ isViewActionShown: false });

    expect(onViewAgent).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'View agent' })).toBeNull();
  });
});
