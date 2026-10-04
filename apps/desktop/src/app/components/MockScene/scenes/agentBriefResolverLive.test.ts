// @vitest-environment node

import { describe, expect, it } from 'vitest';
import type { AgentId, ProviderRunId } from '@goodboy/types';
import { liveHandoff, liveTranscript } from './agentBriefResolverLive';

const AGENT_ID = 'mock-live-agent' as AgentId;
const RUN_ID = 'mock-live-run' as ProviderRunId;

describe('agent brief resolver live seed', () => {
  it('builds the resolve handoff from the production kickoff and leaves the reply pending', () => {
    const handoff = liveHandoff({ agentId: AGENT_ID, flow: 'resolve' });
    const transcript = liveTranscript({ agentId: AGENT_ID, runId: RUN_ID, flow: 'resolve' });

    expect(handoff.sentMessage).toContain('Thread 1 of 1');
    expect(handoff.sentMessage).toContain('<<comment-resolved');
    expect(handoff.sections.find((section) => section.kind === 'ask')?.bodyMd).toBe(
      handoff.sentMessage,
    );
    expect(transcript).toHaveLength(1);
    expect(transcript[0]).toMatchObject({ kind: 'user_text', text: handoff.sentMessage });
  });

  it('provides production re-check and follow-up variants', () => {
    const recheck = liveHandoff({ agentId: AGENT_ID, flow: 'recheck' });
    const followUp = liveHandoff({ agentId: AGENT_ID, flow: 'follow-up' });

    expect(recheck.sentMessage).toContain('<<comment-verdict');
    expect(followUp.sender).toEqual({ kind: 'followUp', sourceAgentId: AGENT_ID });
  });
});
