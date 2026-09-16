import { describe, expect, it } from 'vitest';
import type { Agent, AgentId, IsoDateTime, SessionId, TurnEvent } from '@goodboy/types';
import { artifactEvidenceAgents } from './artifactEvidenceAgents';

const SESSION_ID = 'session-1' as SessionId;
const NOW = '2026-09-16T10:00:00.000Z' as IsoDateTime;

type MakeAgentParams = Readonly<{
  id: string;
  status: Agent['status'];
}>;

const makeAgent = ({ id, status }: MakeAgentParams): Agent => ({
  id: id as AgentId,
  sessionId: SESSION_ID,
  ordinal: 0,
  name: id,
  status,
});

type SaidParams = Readonly<{ text: string }>;

const said = ({ text }: SaidParams): ReadonlyArray<TurnEvent> => [
  { kind: 'assistant_text', runId: 'turn-1' as TurnEvent['runId'], at: NOW, delta: text },
];

describe('artifactEvidenceAgents', () => {
  it('drops the agent that is about to author the artifact', () => {
    const executing = makeAgent({ id: 'writer', status: 'running' });
    const kept = artifactEvidenceAgents({
      agents: [makeAgent({ id: 'scout', status: 'completed' }), executing],
      transcripts: { writer: said({ text: 'an earlier attempt' }) },
      executingAgentId: executing.id,
    });
    expect(kept.map((agent) => agent.id)).toEqual(['scout']);
  });

  it('drops a pending agent that has produced nothing', () => {
    const kept = artifactEvidenceAgents({
      agents: [
        makeAgent({ id: 'scout', status: 'completed' }),
        makeAgent({ id: 'later', status: 'pending' }),
      ],
      transcripts: {},
      executingAgentId: null,
    });
    expect(kept.map((agent) => agent.id)).toEqual(['scout']);
  });

  it('keeps a pending agent that has already said something', () => {
    const kept = artifactEvidenceAgents({
      agents: [makeAgent({ id: 'talker', status: 'pending' })],
      transcripts: { talker: said({ text: 'halfway through' }) },
      executingAgentId: null,
    });
    expect(kept.map((agent) => agent.id)).toEqual(['talker']);
  });

  it('keeps an agent that finished or failed without output, because that is a fact', () => {
    const kept = artifactEvidenceAgents({
      agents: [
        makeAgent({ id: 'silent', status: 'completed' }),
        makeAgent({ id: 'broken', status: 'failed' }),
        makeAgent({ id: 'skipped', status: 'skipped' }),
      ],
      transcripts: {},
      executingAgentId: null,
    });
    expect(kept.map((agent) => agent.id)).toEqual(['silent', 'broken', 'skipped']);
  });

  it('treats whitespace only output as no output', () => {
    const kept = artifactEvidenceAgents({
      agents: [makeAgent({ id: 'later', status: 'pending' })],
      transcripts: { later: said({ text: '   \n  ' }) },
      executingAgentId: null,
    });
    expect(kept).toEqual([]);
  });
});
