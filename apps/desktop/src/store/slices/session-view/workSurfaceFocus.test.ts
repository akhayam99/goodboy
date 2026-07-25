import { describe, expect, it } from 'vitest';
import type { AgentId, SessionId } from '@goodboy/types';
import type { LensKind, SessionStudio } from './types';
import { workSurfaceFocus } from './workSurfaceFocus';

const SESSION_ID = 'session-1' as SessionId;
const AGENT_ID = 'agent-1' as AgentId;

const surface: {
  readonly activeLens: Record<SessionId, LensKind | null>;
  readonly sessionStudio: Record<SessionId, SessionStudio | null>;
  readonly selectedAgentId: Record<SessionId, AgentId | null>;
} = {
  activeLens: { [SESSION_ID]: 'agents' },
  sessionStudio: { [SESSION_ID]: { kind: 'workflow' } },
  selectedAgentId: { [SESSION_ID]: AGENT_ID },
};

describe('workSurfaceFocus', () => {
  it('clears studio and agent when a lens takes focus', () => {
    const next = workSurfaceFocus({
      sessionId: SESSION_ID,
      focus: { kind: 'lens', lens: null },
      ...surface,
    });

    expect(next.activeLens[SESSION_ID]).toBeNull();
    expect(next.sessionStudio[SESSION_ID]).toBeNull();
    expect(next.selectedAgentId[SESSION_ID]).toBeNull();
  });

  it('clears the agent but keeps the lens when a studio takes focus', () => {
    const next = workSurfaceFocus({
      sessionId: SESSION_ID,
      focus: { kind: 'studio', studio: { kind: 'workflow' } },
      ...surface,
      sessionStudio: {},
    });

    expect(next.sessionStudio[SESSION_ID]).toEqual({ kind: 'workflow' });
    expect(next.selectedAgentId[SESSION_ID]).toBeNull();
    expect(next.activeLens[SESSION_ID]).toBe('agents');
  });

  it('clears the studio when an agent takes focus', () => {
    const next = workSurfaceFocus({
      sessionId: SESSION_ID,
      focus: { kind: 'agent', agentId: AGENT_ID },
      ...surface,
      selectedAgentId: {},
    });

    expect(next.selectedAgentId[SESSION_ID]).toBe(AGENT_ID);
    expect(next.sessionStudio[SESSION_ID]).toBeNull();
  });

  it('seeds the lens on creation and lets the studio win over the first agent', () => {
    const next = workSurfaceFocus({
      sessionId: SESSION_ID,
      focus: { kind: 'session-created', studio: { kind: 'workflow' }, agentId: AGENT_ID },
      activeLens: {},
      sessionStudio: {},
      selectedAgentId: {},
    });

    expect(next.activeLens[SESSION_ID]).toBeNull();
    expect(next.sessionStudio[SESSION_ID]).toEqual({ kind: 'workflow' });
    expect(next.selectedAgentId[SESSION_ID]).toBeNull();
  });

  it('selects the first agent on creation when no studio is requested', () => {
    const next = workSurfaceFocus({
      sessionId: SESSION_ID,
      focus: { kind: 'session-created', studio: null, agentId: AGENT_ID },
      activeLens: {},
      sessionStudio: {},
      selectedAgentId: {},
    });

    expect(next.selectedAgentId[SESSION_ID]).toBe(AGENT_ID);
    expect(next.sessionStudio[SESSION_ID]).toBeNull();
  });
});
