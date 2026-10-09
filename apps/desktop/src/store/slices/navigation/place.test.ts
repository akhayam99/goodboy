// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { AgentId, SessionId } from '@goodboy/types';
import { branchPlace, fixRunTranscript } from './place';

const SESSION_ID = 'session-1' as SessionId;
const AGENT_ID = 'agent-1' as AgentId;

describe('the fix run transcript door', () => {
  it('lands on Files with the transcript for a note thread', () => {
    const door = fixRunTranscript({
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
      threadId: 'note:mock-note-backoff-cap',
    });

    expect(door.to).toEqual(
      branchPlace({
        sessionId: SESSION_ID,
        tab: 'files',
        threadId: 'note:mock-note-backoff-cap',
      }),
    );
    expect(door.drawer).toEqual({
      kind: 'transcript',
      sessionId: SESSION_ID,
      payload: { agentId: AGENT_ID },
    });
  });

  it('stays on Comments for a pull request comment thread and for no thread', () => {
    expect(
      fixRunTranscript({ sessionId: SESSION_ID, agentId: AGENT_ID, threadId: 'PRRT_1' }).to,
    ).toEqual(branchPlace({ sessionId: SESSION_ID, tab: 'comments', threadId: 'PRRT_1' }));
    expect(fixRunTranscript({ sessionId: SESSION_ID, agentId: AGENT_ID }).to).toEqual(
      branchPlace({ sessionId: SESSION_ID, tab: 'comments' }),
    );
  });

  it('keeps the mount of the run on either tab', () => {
    expect(
      fixRunTranscript({
        sessionId: SESSION_ID,
        agentId: AGENT_ID,
        threadId: 'note:n1',
        mountPath: '/repo/ledger-core',
      }).to,
    ).toEqual(
      branchPlace({
        sessionId: SESSION_ID,
        mountPath: '/repo/ledger-core',
        tab: 'files',
        threadId: 'note:n1',
      }),
    );
  });
});
