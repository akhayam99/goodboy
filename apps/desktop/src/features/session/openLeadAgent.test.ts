import { describe, expect, it, vi } from 'vitest';
import { brandId, type AgentId, type SessionId } from '@goodboy/types';
import { agentPlace } from '../../store/slices/navigation/place';
import { openLeadAgent } from './openLeadAgent';
import { useLeadSelectionStore } from './hooks/useLeadSelectionStore';

const SESSION = brandId<SessionId>({ value: 'session-harborline' });
const LEAD = brandId<AgentId>({ value: 'agent-lead' });
const TESTER = brandId<AgentId>({ value: 'agent-tester' });

describe('openLeadAgent', () => {
  it('selects the agent and opens the Lead page', () => {
    const navigate = vi.fn();

    openLeadAgent({ navigate, sessionId: SESSION, leadAgentId: LEAD, agentId: TESTER });

    expect(useLeadSelectionStore.getState().selectedByLead[LEAD]).toBe(TESTER);
    expect(navigate).toHaveBeenCalledWith({
      to: agentPlace({ sessionId: SESSION, agentId: LEAD }),
    });
  });

  it('keeps the selection of one Lead apart from another', () => {
    useLeadSelectionStore.getState().select({ leadAgentId: LEAD, agentId: TESTER });

    expect(useLeadSelectionStore.getState().selectedByLead['agent-other']).toBeUndefined();
  });
});
