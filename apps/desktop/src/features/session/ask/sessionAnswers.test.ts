// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type AgentId } from '@goodboy/types';
import { NAMES } from '../../../shared/utils/names';
import { askStarterOf } from './askStarterOf';
import { doingAnswerOf } from './doingAnswerOf';
import { leftAnswerOf } from './leftAnswerOf';

const IMPLEMENTER = brandId<AgentId>({ value: 'agent-implementer' });
const LEAD = brandId<AgentId>({ value: 'agent-lead' });

describe('askStarterOf', () => {
  it.each([
    ['What are you doing?', 'doing'],
    ['  what are you doing ', 'doing'],
    ['What is left?', 'left'],
    ['Why did integration-tests fail on #418?', null],
  ] as const)('reads %s as %s', (question, starter) => {
    expect(askStarterOf({ question })).toBe(starter);
  });
});

describe('doingAnswerOf', () => {
  it('names each running agent and the step of each branch', () => {
    const answer = doingAnswerOf({
      runs: [
        { agentId: IMPLEMENTER, agent: 'Implementer', phrase: 'Running pnpm test in notify-relay' },
      ],
      branches: [
        { project: 'payments-api', branch: 'hl/fix-duplicate-credit', word: 'Checks failing' },
      ],
    });
    expect(answer.text).toBe(
      'Implementer: Running pnpm test in notify-relay. payments-api on hl/fix-duplicate-credit: Checks failing.',
    );
    expect(answer.sources).toEqual(['Live work, 1 agent', 'Branch hl/fix-duplicate-credit']);
    expect(answer.agentId).toBe(IMPLEMENTER);
  });

  it('names every running agent, never a count in place of the fifth and later ones', () => {
    const runs = Array.from({ length: 6 }, (_, index) => ({
      agentId: null,
      agent: `Implementer ${index + 1}`,
      phrase: `Running pnpm test shard-${index + 1}`,
    }));
    const answer = doingAnswerOf({ runs, branches: [] });
    expect(answer.text).toBe(runs.map((run) => `${run.agent}: ${run.phrase}.`).join(' '));
    expect(answer.text).not.toContain('more agent');
    expect(answer.sources).toEqual(['Live work, 6 agents']);
  });

  it('says nothing runs when no agent has a live turn', () => {
    expect(doingAnswerOf({ runs: [], branches: [] }).text).toBe(
      'Nothing is running in this session.',
    );
  });
});

describe('leftAnswerOf', () => {
  it('lists the parts of the plan that are not done', () => {
    const answer = leftAnswerOf({
      plan: {
        title: 'Keep the retry count',
        total: 3,
        left: ['Fix state.test.ts', 'Open the PR'],
        hasRun: true,
      },
      leadId: null,
    });
    expect(answer.text).toBe('2 parts left in the plan: Fix state.test.ts, Open the PR.');
    expect(answer.sources).toEqual(['Plan, Keep the retry count']);
  });

  it('says when no part has started', () => {
    expect(
      leftAnswerOf({
        plan: {
          title: 'Keep the retry count',
          total: 1,
          left: ['Fix state.test.ts'],
          hasRun: false,
        },
        leadId: null,
      }).text,
    ).toBe('1 part left in the plan, none started: Fix state.test.ts.');
  });

  it('never guesses without a plan and points at the Lead', () => {
    const answer = leftAnswerOf({ plan: null, leadId: LEAD });
    expect(answer.text).toBe(`${NAMES.noPlanOnThisSession}. Message the Lead to ask for one.`);
    expect(answer.agentId).toBe(LEAD);
  });
});
