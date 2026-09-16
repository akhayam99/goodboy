import { describe, expect, it, vi } from 'vitest';
import type { AgentId, SessionId } from '@goodboy/types';
import type { AppStore } from '../../store';
import type { GetFn, SetFn } from './types';
import { closeArtifactConversation, openArtifactConversation } from './artifactConversation';
import { setSessionStudio } from './workSurface';

const SESSION_ID = 'sess-1' as SessionId;
const AGENT_ID = 'agent-report-1' as AgentId;
const OTHER_AGENT_ID = 'agent-report-2' as AgentId;

const buildStore = () => {
  const selectAgent = vi.fn(async (sessionId: SessionId, agentId: AgentId) => {
    state = {
      ...state,
      activeLens: { ...state.activeLens, [sessionId]: state.activeLens[sessionId] ?? null },
      sessionStudio: { ...state.sessionStudio, [sessionId]: null },
      selectedAgentId: { ...state.selectedAgentId, [sessionId]: agentId },
    };
  });
  let state = {
    activeLens: { [SESSION_ID]: 'plans' },
    sessionStudio: {},
    selectedAgentId: {},
    artifactConversationAgentId: {},
    selectAgent,
  } as unknown as AppStore;
  const set: SetFn = (patch) => {
    const next = typeof patch === 'function' ? patch(state) : patch;
    state = { ...state, ...next };
  };
  const get: GetFn = () => state;
  return {
    set,
    get,
    selectAgent,
    read: () => state,
  };
};

describe('artifact conversation host', () => {
  it('selects the same agent the agents lens would select, so there is one history', () => {
    const store = buildStore();
    openArtifactConversation(store.set, store.get)({ sessionId: SESSION_ID, agentId: AGENT_ID });
    expect(store.selectAgent).toHaveBeenCalledWith(SESSION_ID, AGENT_ID);
    expect(store.read().selectedAgentId[SESSION_ID]).toBe(AGENT_ID);
    expect(store.read().artifactConversationAgentId[SESSION_ID]).toBe(AGENT_ID);
  });

  it('keeps the artifact lens instead of dropping it for the agent overlay', () => {
    const store = buildStore();
    openArtifactConversation(store.set, store.get)({ sessionId: SESSION_ID, agentId: AGENT_ID });
    expect(store.read().activeLens[SESSION_ID]).toBe('plans');
  });

  it('survives a reveal-chat, which only closes a session studio', () => {
    const store = buildStore();
    openArtifactConversation(store.set, store.get)({ sessionId: SESSION_ID, agentId: AGENT_ID });
    setSessionStudio(store.set)(SESSION_ID, null);
    expect(store.read().artifactConversationAgentId[SESSION_ID]).toBe(AGENT_ID);
    expect(store.read().selectedAgentId[SESSION_ID]).toBe(AGENT_ID);
    expect(store.read().activeLens[SESSION_ID]).toBe('plans');
  });

  it('releases the selection when the conversation it owns is closed', () => {
    const store = buildStore();
    openArtifactConversation(store.set, store.get)({ sessionId: SESSION_ID, agentId: AGENT_ID });
    closeArtifactConversation(store.set)({ sessionId: SESSION_ID, agentId: AGENT_ID });
    expect(store.read().artifactConversationAgentId[SESSION_ID]).toBeNull();
    expect(store.read().selectedAgentId[SESSION_ID]).toBeNull();
  });

  it('does not steal a selection that moved to another agent meanwhile', () => {
    const store = buildStore();
    openArtifactConversation(store.set, store.get)({ sessionId: SESSION_ID, agentId: AGENT_ID });
    void store.get().selectAgent(SESSION_ID, OTHER_AGENT_ID);
    closeArtifactConversation(store.set)({ sessionId: SESSION_ID, agentId: AGENT_ID });
    expect(store.read().selectedAgentId[SESSION_ID]).toBe(OTHER_AGENT_ID);
  });
});
