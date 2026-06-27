import { describe, expect, it } from 'vitest';
import type { Agent, OpenQuestion, SessionStageInfo } from '@goodboy/types';
import type { AgentKind } from '../../agent-kind';
import {
  isStandaloneAgent,
  resolveAttentionLens,
  selectAttention,
  selectNonResolverStandaloneAgents,
  selectOpenQuestions,
  selectStandaloneAgents,
} from './lib';

const agent = (over: Partial<Agent>): Agent =>
  ({
    id: 'a',
    name: '',
    parentAgentId: null,
    workflowRunId: null,
    stepId: null,
    ...over,
  }) as unknown as Agent;

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
  const ctx = { hasNonResolverStandalone: false, hasWorkflow: false, hasResolver: false };

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

  const lensFor = (
    hasNonResolverStandalone: boolean,
    hasWorkflow: boolean,
    hasResolver: boolean,
  ) => {
    if (hasNonResolverStandalone) return 'agents';
    if (hasResolver) return 'resolve';
    if (hasWorkflow) return 'workflows';
    return null;
  };

  for (const hasNonResolverStandalone of [false, true]) {
    for (const hasWorkflow of [false, true]) {
      for (const hasResolver of [false, true]) {
        const expected = lensFor(hasNonResolverStandalone, hasWorkflow, hasResolver);
        it(`routes nonResolver=${hasNonResolverStandalone} workflow=${hasWorkflow} resolver=${hasResolver} to ${expected}`, () => {
          expect(
            resolveAttentionLens(stage({ stage: 'attention', reason: 'idle' }), {
              hasNonResolverStandalone,
              hasWorkflow,
              hasResolver,
            }),
          ).toBe(expected);
        });
      }
    }
  }

  it('routes a workflow-only attention session to workflows, never null', () => {
    expect(
      resolveAttentionLens(stage({ stage: 'attention', reason: 'idle' }), {
        hasNonResolverStandalone: false,
        hasWorkflow: true,
        hasResolver: false,
      }),
    ).toBe('workflows');
  });

  it('returns null when no agent, resolver or workflow is present', () => {
    expect(resolveAttentionLens(stage({ stage: 'attention', reason: 'idle' }), ctx)).toBeNull();
  });
});

describe('selectNonResolverStandaloneAgents', () => {
  const text = new Map<string, string>();

  it('keeps a generic standalone agent', () => {
    const list = [agent({ id: 'g' as Agent['id'], name: 'explore the repo' })];
    expect(selectNonResolverStandaloneAgents(list, {}, text)).toHaveLength(1);
  });

  it('excludes a name-classified resolver', () => {
    const list = [agent({ id: 'r' as Agent['id'], name: 'resolve foo' })];
    expect(selectNonResolverStandaloneAgents(list, {}, text)).toHaveLength(0);
  });

  it('excludes an agent overridden to resolver', () => {
    const list = [agent({ id: 'o' as Agent['id'], name: 'explore the repo' })];
    const override: Record<string, AgentKind> = { o: 'resolver' };
    expect(selectNonResolverStandaloneAgents(list, override, text)).toHaveLength(0);
  });

  it('excludes a workflow-step agent that is not standalone', () => {
    const list = [
      agent({
        id: 'w' as Agent['id'],
        name: 'step agent',
        workflowRunId: 'run' as Agent['workflowRunId'],
        stepId: 'step' as Agent['stepId'],
      }),
    ];
    expect(selectNonResolverStandaloneAgents(list, {}, text)).toHaveLength(0);
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
