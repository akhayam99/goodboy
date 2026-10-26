// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type AgentId, type IsoDateTime, type SessionId } from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import { unreadTargetOf } from './unreadTargetOf';

const SESSION = brandId<SessionId>({ value: 'session-harborline' });
const EARLIER = brandId<AgentId>({ value: 'agent-earlier' });
const LATER = brandId<AgentId>({ value: 'agent-later' });
const RUNNING = brandId<AgentId>({ value: 'agent-running' });

const at = (value: string) => brandId<IsoDateTime>({ value });

const earlier = anAgent({
  id: EARLIER,
  sessionId: SESSION,
  status: 'completed',
  lastFinishedAt: at('2026-10-06T08:00:00.000Z'),
});

const later = anAgent({
  id: LATER,
  sessionId: SESSION,
  status: 'completed',
  lastFinishedAt: at('2026-10-06T09:00:00.000Z'),
});

const running = anAgent({ id: RUNNING, sessionId: SESSION, status: 'running' });

type UnreadTargetState = Parameters<typeof unreadTargetOf>[0]['state'];

const stateOf = (over: Partial<UnreadTargetState> = {}): UnreadTargetState => ({
  sessionPhaseRuns: { [SESSION]: [earlier, later, running] },
  selectedAgentId: {},
  currentSessionId: null,
  ...over,
});

describe('unreadTargetOf', () => {
  it('picks the agent that finished last', () => {
    expect(unreadTargetOf({ state: stateOf(), sessionId: SESSION })?.id).toBe(LATER);
  });

  it('skips an agent that never finished', () => {
    expect(
      unreadTargetOf({
        state: stateOf({ sessionPhaseRuns: { [SESSION]: [running] } }),
        sessionId: SESSION,
      }),
    ).toBeNull();
  });

  it('skips an agent put away as done and one that was skipped', () => {
    const done = { ...later, doneAt: at('2026-10-06T10:00:00.000Z') };
    const skipped = { ...later, status: 'skipped' as const };

    expect(
      unreadTargetOf({
        state: stateOf({ sessionPhaseRuns: { [SESSION]: [earlier, done, skipped] } }),
        sessionId: SESSION,
      })?.id,
    ).toBe(EARLIER);
  });

  it('leaves out the agent on screen in the open session, which counts as seen', () => {
    const state = stateOf({ currentSessionId: SESSION, selectedAgentId: { [SESSION]: LATER } });

    expect(unreadTargetOf({ state, sessionId: SESSION })?.id).toBe(EARLIER);
  });

  it('keeps that agent when the session is not the open one', () => {
    const state = stateOf({ selectedAgentId: { [SESSION]: LATER } });

    expect(unreadTargetOf({ state, sessionId: SESSION })?.id).toBe(LATER);
  });

  it('finds nothing for a session with no agents', () => {
    expect(unreadTargetOf({ state: stateOf(), sessionId: brandId({ value: 'other' }) })).toBeNull();
  });
});
