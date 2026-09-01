import { describe, expect, it } from 'vitest';
import type { OpenQuestion, SessionStageInfo } from '@goodboy/types';
import { resolveAttentionLens, selectOpenQuestions } from './lib';

const stage = (over: Partial<SessionStageInfo>): SessionStageInfo =>
  ({ stage: 'building', reason: '', attention: null, ...over }) satisfies SessionStageInfo;

const question = (over: Partial<OpenQuestion>): OpenQuestion =>
  ({ status: 'open', text: 'q', ...over }) as unknown as OpenQuestion;

describe('resolveAttentionLens', () => {
  const ctx = {
    hasNonResolverStandalone: false,
    hasWorkflow: false,
    hasResolver: false,
    unreadLens: null,
  };

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

  it('routes an unread resolver reply to resolve when standalone agents are present', () => {
    expect(
      resolveAttentionLens(stage({ stage: 'attention', reason: 'unread agent reply' }), {
        hasNonResolverStandalone: true,
        hasWorkflow: false,
        hasResolver: true,
        unreadLens: 'resolve',
      }),
    ).toBe('resolve');
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
              unreadLens: null,
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
        unreadLens: null,
      }),
    ).toBe('workflows');
  });

  it('returns null when no agent, resolver or workflow is present', () => {
    expect(resolveAttentionLens(stage({ stage: 'attention', reason: 'idle' }), ctx)).toBeNull();
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
