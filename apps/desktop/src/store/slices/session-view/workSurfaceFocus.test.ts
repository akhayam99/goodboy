// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { AgentId, SessionId } from '@goodboy/types';
import type { LensKind } from './types';
import { workSurfaceFocus } from './workSurfaceFocus';

const SESSION_ID = 'session-1' as SessionId;
const AGENT_ID = 'agent-1' as AgentId;

const surface: {
  readonly activeLens: Record<SessionId, LensKind | null>;
  readonly selectedAgentId: Record<SessionId, AgentId | null>;
} = {
  activeLens: { [SESSION_ID]: 'agents' },
  selectedAgentId: { [SESSION_ID]: AGENT_ID },
};

describe('workSurfaceFocus', () => {
  it('clears the agent when a lens takes focus', () => {
    const next = workSurfaceFocus({
      sessionId: SESSION_ID,
      focus: { kind: 'lens', lens: null },
      ...surface,
    });

    expect(next.activeLens[SESSION_ID]).toBeNull();
    expect(next.selectedAgentId[SESSION_ID]).toBeNull();
  });

  it('keeps the lens when an agent takes focus', () => {
    const next = workSurfaceFocus({
      sessionId: SESSION_ID,
      focus: { kind: 'agent', agentId: AGENT_ID },
      ...surface,
      selectedAgentId: {},
    });

    expect(next.selectedAgentId[SESSION_ID]).toBe(AGENT_ID);
    expect(next.activeLens[SESSION_ID]).toBe('agents');
  });

  it('seeds the lens and selects the first agent on creation', () => {
    const next = workSurfaceFocus({
      sessionId: SESSION_ID,
      focus: { kind: 'session-created', agentId: AGENT_ID },
      activeLens: {},
      selectedAgentId: {},
    });

    expect(next.activeLens[SESSION_ID]).toBeNull();
    expect(next.selectedAgentId[SESSION_ID]).toBe(AGENT_ID);
  });
});
