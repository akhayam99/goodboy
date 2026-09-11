import { describe, expect, it } from 'vitest';
import type { Agent, AgentId, OpenQuestion, SessionStageInfo } from '@goodboy/types';
import { attentionAgentId, resolveAttentionTarget, selectOpenQuestions } from './lib';

const stage = (over: Partial<SessionStageInfo>): SessionStageInfo =>
  ({
    stage: 'building',
    reason: '',
    attention: null,
    prState: null,
    ...over,
  }) satisfies SessionStageInfo;

const question = (over: Partial<OpenQuestion>): OpenQuestion =>
  ({ status: 'open', text: 'q', ...over }) as unknown as OpenQuestion;

const agentWith = (over: Partial<Agent> & Pick<Agent, 'id'>): Agent =>
  ({ status: 'completed', ...over }) as unknown as Agent;

describe('resolveAttentionTarget', () => {
  it('returns nothing while the session does not need anyone', () => {
    expect(resolveAttentionTarget({ stage: stage({}), agent: null })).toBeNull();
  });

  it('sends an open question to the questions lens', () => {
    expect(
      resolveAttentionTarget({
        stage: stage({ stage: 'attention', attention: 'open-question' }),
        agent: null,
      }),
    ).toEqual({ kind: 'lens', lens: 'questions', label: 'Answer it' });
  });

  it.each(['ci-failed', 'changes-requested', 'pr-approved'] as const)(
    'sends %s to the pull request',
    (attention) => {
      expect(
        resolveAttentionTarget({ stage: stage({ stage: 'attention', attention }), agent: null }),
      ).toEqual({ kind: 'lens', lens: 'pr', label: 'Open the pull request' });
    },
  );

  it('opens the failed agent itself, not the agents lens', () => {
    expect(
      resolveAttentionTarget({
        stage: stage({ stage: 'attention', attention: 'agent-error' }),
        agent: { agentId: 'agent-9' as AgentId, home: 'workflows' },
      }),
    ).toEqual({
      kind: 'agent',
      agentId: 'agent-9',
      home: 'workflows',
      label: 'Open the failed turn',
    });
  });

  it('opens the agent that replied, not the agents lens', () => {
    expect(
      resolveAttentionTarget({
        stage: stage({ stage: 'attention', attention: 'unread-reply' }),
        agent: { agentId: 'agent-3' as AgentId, home: 'review' },
      }),
    ).toEqual({ kind: 'agent', agentId: 'agent-3', home: 'review', label: 'Read the reply' });
  });

  it('falls back to the agents lens when no agent carries the signal', () => {
    expect(
      resolveAttentionTarget({
        stage: stage({ stage: 'attention', attention: 'agent-error' }),
        agent: null,
      }),
    ).toEqual({ kind: 'lens', lens: 'agents', label: 'Open the agents' });
  });
});

describe('attentionAgentId', () => {
  it('picks the latest failed agent for an agent error', () => {
    const agents = [
      agentWith({ id: 'a1' as AgentId, status: 'failed' }),
      agentWith({ id: 'a2' as AgentId, status: 'completed' }),
      agentWith({ id: 'a3' as AgentId, status: 'failed' }),
    ];

    expect(
      attentionAgentId({ stage: stage({ stage: 'attention', attention: 'agent-error' }), agents }),
    ).toBe('a3');
  });

  it('picks the latest unread agent for an unread reply', () => {
    const agents = [
      agentWith({ id: 'a1' as AgentId, lastFinishedAt: '2026-01-01T00:00:00.000Z' } as never),
      agentWith({ id: 'a2' as AgentId }),
    ];

    expect(
      attentionAgentId({ stage: stage({ stage: 'attention', attention: 'unread-reply' }), agents }),
    ).toBe('a1');
  });

  it('picks nobody for a reason no agent owns', () => {
    expect(
      attentionAgentId({
        stage: stage({ stage: 'attention', attention: 'ci-failed' }),
        agents: [agentWith({ id: 'a1' as AgentId, status: 'failed' })],
      }),
    ).toBeNull();
  });

  it('picks nobody when no agent matches', () => {
    expect(
      attentionAgentId({
        stage: stage({ stage: 'attention', attention: 'agent-error' }),
        agents: [agentWith({ id: 'a1' as AgentId, status: 'completed' })],
      }),
    ).toBeNull();
  });
});

describe('selectOpenQuestions', () => {
  it('keeps only open questions', () => {
    const list = [
      question({ status: 'open' }),
      question({ status: 'answered' as OpenQuestion['status'] }),
      question({ status: 'open' }),
    ];
    expect(selectOpenQuestions(list)).toHaveLength(2);
  });
});
