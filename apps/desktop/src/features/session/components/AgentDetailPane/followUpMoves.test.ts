import { describe, expect, it } from 'vitest';
import type { Agent, AgentId } from '@goodboy/types';
import { agentFollowUpMoves, composeFollowUpSeed } from './followUpMoves';

type BuildAgentInput = Omit<Partial<Agent>, 'id'> & { readonly name: string; readonly id: string };

const buildAgent = ({ id, ...rest }: BuildAgentInput): Agent =>
  ({
    sessionId: 'session-1',
    ordinal: 0,
    status: 'completed',
    id: id as AgentId,
    ...rest,
  }) as Agent;

describe('agentFollowUpMoves', () => {
  it('offers plan and implement after a review', () => {
    const moves = agentFollowUpMoves({ sourceKind: 'reviewer' }).map((m) => m.kind);
    expect(moves).toEqual(['planner', 'implementer']);
  });

  it('offers only implement after a plan', () => {
    const moves = agentFollowUpMoves({ sourceKind: 'planner' }).map((m) => m.kind);
    expect(moves).toEqual(['implementer']);
  });

  it('offers plan and implement after a scout', () => {
    const moves = agentFollowUpMoves({ sourceKind: 'scout' }).map((m) => m.kind);
    expect(moves).toEqual(['planner', 'implementer']);
  });

  it('offers implement after a debug', () => {
    const moves = agentFollowUpMoves({ sourceKind: 'debugger' }).map((m) => m.kind);
    expect(moves).toEqual(['implementer']);
  });

  it('offers no follow-up for implementer, tester, docs, generic', () => {
    for (const kind of ['implementer', 'tester', 'docs', 'generic'] as const) {
      expect(agentFollowUpMoves({ sourceKind: kind })).toHaveLength(0);
    }
  });

  it('offers no follow-up for resolver and pr-reviewer', () => {
    expect(agentFollowUpMoves({ sourceKind: 'resolver' })).toHaveLength(0);
    expect(agentFollowUpMoves({ sourceKind: 'pr-reviewer' })).toHaveLength(0);
  });

  it('names the source in the seed and passes the summary through', () => {
    const source = buildAgent({ id: 'agent-1', name: 'review one' });
    const seed = composeFollowUpSeed({ sourceAgent: source, summary: 'Found a bug in auth.' });
    expect(seed).toContain('Follow-up from review one.');
    expect(seed).toContain('Found a bug in auth.');
  });

  it('strips the control markers before passing the summary through', () => {
    const source = buildAgent({ id: 'agent-1', name: 'plan agent' });
    const seed = composeFollowUpSeed({
      sourceAgent: source,
      summary: 'Body text.\n<<handoff kind=implementer reason="do it">>',
    });
    expect(seed).toContain('Body text.');
    expect(seed).not.toContain('<<handoff');
  });

  it('renders a header alone when the summary is empty', () => {
    const source = buildAgent({ id: 'agent-1', name: 'scout' });
    const seed = composeFollowUpSeed({ sourceAgent: source, summary: '' });
    expect(seed).toBe('Follow-up from scout.');
  });
});
