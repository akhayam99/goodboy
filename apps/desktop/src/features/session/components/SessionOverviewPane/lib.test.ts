import { describe, expect, it } from 'vitest';
import type { Agent, OpenQuestion, SessionStageInfo } from '@goodboy/types';
import {
  isStandaloneAgent,
  resolveAttentionLens,
  selectAttention,
  selectOpenQuestions,
  selectStandaloneAgents,
} from './lib';

const agent = (over: Partial<Agent>): Agent =>
  ({ parentAgentId: null, workflowRunId: null, stepId: null, ...over }) as unknown as Agent;

const stage = (over: Partial<SessionStageInfo>): SessionStageInfo =>
  ({ stage: 'building', reason: '', ...over }) as SessionStageInfo;

const question = (over: Partial<OpenQuestion>): OpenQuestion =>
  ({ status: 'open', text: 'q', ...over }) as unknown as OpenQuestion;

describe('isStandaloneAgent', () => {
  it('treats a top-level agent with no workflow binding as standalone', () => {
    expect(isStandaloneAgent(agent({}))).toBe(true);
  });

  it('rejects a child agent', () => {
    expect(isStandaloneAgent(agent({ parentAgentId: 'a1' as Agent['parentAgentId'] }))).toBe(false);
  });

  it('rejects an agent bound to a workflow step', () => {
    expect(
      isStandaloneAgent(
        agent({
          workflowRunId: 'run1' as Agent['workflowRunId'],
          stepId: 'step1' as Agent['stepId'],
        }),
      ),
    ).toBe(false);
  });

  it('keeps an agent that has a workflowRunId but no stepId', () => {
    expect(isStandaloneAgent(agent({ workflowRunId: 'run1' as Agent['workflowRunId'] }))).toBe(
      true,
    );
  });
});

describe('selectStandaloneAgents', () => {
  it('filters out child and workflow-bound agents', () => {
    const list = [
      agent({}),
      agent({ parentAgentId: 'p' as Agent['parentAgentId'] }),
      agent({
        workflowRunId: 'r' as Agent['workflowRunId'],
        stepId: 's' as Agent['stepId'],
      }),
    ];
    expect(selectStandaloneAgents(list)).toHaveLength(1);
  });

  it('returns an empty array when given none', () => {
    expect(selectStandaloneAgents([])).toEqual([]);
  });
});

describe('selectAttention', () => {
  it('flags active when the stage is attention and carries the reason', () => {
    expect(selectAttention(stage({ stage: 'attention', reason: 'needs you' }))).toEqual({
      active: true,
      reason: 'needs you',
    });
  });

  it('is inactive for any other stage', () => {
    expect(selectAttention(stage({ stage: 'running', reason: 'x' })).active).toBe(false);
  });
});

describe('resolveAttentionLens', () => {
  const ctx = { hasStandalone: false, hasWorkflow: false };

  it('returns null when not in the attention stage', () => {
    expect(resolveAttentionLens(stage({ stage: 'running' }), ctx)).toBeNull();
  });

  it('routes a PR reason to the pr lens', () => {
    expect(
      resolveAttentionLens(stage({ stage: 'attention', reason: 'PR needs review' }), ctx),
    ).toBe('pr');
  });

  it('routes a question reason to the questions lens', () => {
    expect(
      resolveAttentionLens(stage({ stage: 'attention', reason: 'an open question' }), ctx),
    ).toBe('questions');
  });

  it('prefers standalone agents over workflows', () => {
    expect(
      resolveAttentionLens(stage({ stage: 'attention', reason: 'idle' }), {
        hasStandalone: true,
        hasWorkflow: true,
      }),
    ).toBe('agents');
  });

  it('falls back to workflows when only a workflow is present', () => {
    expect(
      resolveAttentionLens(stage({ stage: 'attention', reason: 'idle' }), {
        hasStandalone: false,
        hasWorkflow: true,
      }),
    ).toBe('workflows');
  });

  it('defaults to agents when nothing else matches', () => {
    expect(resolveAttentionLens(stage({ stage: 'attention', reason: 'idle' }), ctx)).toBe('agents');
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
