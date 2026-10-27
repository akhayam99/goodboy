// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type AgentId, type SessionId } from '@goodboy/types';
import { viewedAgentIdOf } from './viewedAgentIdOf';

const SESSION = brandId<SessionId>({ value: 'session-harborline' });
const OTHER = brandId<SessionId>({ value: 'session-northwind' });
const AGENT = brandId<AgentId>({ value: 'agent-reviewer' });

describe('viewedAgentIdOf', () => {
  it('returns the agent open in the session in view', () => {
    const state = { currentSessionId: SESSION, selectedAgentId: { [SESSION]: AGENT } };

    expect(viewedAgentIdOf({ state, sessionId: SESSION })).toBe(AGENT);
  });

  it('returns null for a session that is not in view', () => {
    const state = { currentSessionId: OTHER, selectedAgentId: { [SESSION]: AGENT } };

    expect(viewedAgentIdOf({ state, sessionId: SESSION })).toBeNull();
  });

  it('returns null when the session in view has no agent open', () => {
    const state = { currentSessionId: SESSION, selectedAgentId: {} };

    expect(viewedAgentIdOf({ state, sessionId: SESSION })).toBeNull();
  });
});
