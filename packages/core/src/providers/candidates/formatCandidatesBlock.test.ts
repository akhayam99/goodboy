import { describe, expect, it } from 'vitest';
import type { AgentRole, StepSize } from '@goodboy/types';
import { AUTO_DELEGATION_ROLES } from '../../auto/roles';
import { RUNGS } from '../autoRouting/effortLadder';
import { bestCandidate } from './bestCandidate';
import { buildCandidates } from './buildCandidates';
import { candidateInputsOf } from './candidateFixtures';
import { CANDIDATES_BLOCK_BUDGET, formatCandidatesBlock } from './formatCandidatesBlock';
import type { CandidateInputs } from './types';

const SIZES: ReadonlyArray<StepSize> = ['small', 'medium', 'large'];

const STEP_ROLES: ReadonlyArray<AgentRole> = [...AUTO_DELEGATION_ROLES, 'resolver', 'ci-debugger'];

type BlockParams = {
  readonly inputs: CandidateInputs;
  readonly roles?: ReadonlyArray<AgentRole>;
  readonly runBudgetLeftUsd?: number | null;
  readonly budget?: number;
};

const block = ({
  inputs,
  roles = AUTO_DELEGATION_ROLES,
  runBudgetLeftUsd = null,
  budget,
}: BlockParams): string | null =>
  formatCandidatesBlock({
    inputs,
    roles,
    scope: 'helper',
    runBudgetLeftUsd,
    ...(budget !== undefined && { budget }),
  });

type SmallestParams = {
  readonly inputs: CandidateInputs;
};

const smallestBudget = ({ inputs }: SmallestParams): number => {
  let low = 0;
  let high = CANDIDATES_BLOCK_BUDGET;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (block({ inputs, budget: middle }) === null) {
      low = middle + 1;
      continue;
    }
    high = middle;
  }
  return low;
};

describe('formatCandidatesBlock', () => {
  it('fits the budget with three providers and lists each one in the user order', () => {
    const text = block({
      inputs: candidateInputsOf({
        room: {
          anthropic: { usedPercent: 62, isEstimated: false },
          cursor: { usedPercent: 40, isEstimated: true },
          codex: { usedPercent: 18, isEstimated: false },
        },
        load: { anthropic: 3, cursor: 1, codex: 2 },
      }),
      runBudgetLeftUsd: 3.4,
    });
    expect(text).not.toBeNull();
    expect(text?.length).toBeLessThanOrEqual(CANDIDATES_BLOCK_BUDGET);
    expect(text).toContain('1. anthropic, 62% used, 3 agents in the last hour: ');
    expect(text).toContain('2. cursor, about 40% used, estimated, 1 agent in the last hour: ');
    expect(text).toContain('3. codex, 18% used, 2 agents in the last hour: ');
    expect(text).toContain('This run has $3.40 of budget left.');
  });

  it('fits the budget with six providers and every rung', () => {
    const text = formatCandidatesBlock({
      inputs: candidateInputsOf({
        on: ['anthropic', 'cursor', 'codex', 'gemini', 'copilot', 'opencode'],
      }),
      roles: STEP_ROLES,
      scope: 'step',
    });
    expect(text?.length).toBeLessThanOrEqual(CANDIDATES_BLOCK_BUDGET);
    for (const provider of ['anthropic', 'cursor', 'codex', 'gemini', 'copilot', 'opencode']) {
      expect(text).toMatch(new RegExp(`^\\d\\. ${provider}`, 'm'));
    }
    for (const rung of RUNGS.filter((rung) => rung !== 'quick')) {
      expect(text).toContain(`${rung} `);
    }
  });

  it('asks a workflow orchestrator for the next step, not for each child', () => {
    const inputs = candidateInputsOf({ on: ['anthropic', 'codex'] });
    const step = formatCandidatesBlock({ inputs, roles: STEP_ROLES, scope: 'step' });
    const helper = block({ inputs });
    expect(step).toContain('For the next step, copy "provider", "model" and "effort"');
    expect(step).not.toContain('For each child');
    expect(helper).toContain('For each child, copy');
  });

  it('drops the rates, then the facts, then the last providers, and never goes over', () => {
    const inputs = candidateInputsOf({ on: ['anthropic', 'cursor', 'codex', 'gemini', 'copilot'] });
    const full = block({ inputs }) ?? '';
    const tight = block({ inputs, budget: full.length - 1 }) ?? '';
    const tiny = block({ inputs, budget: smallestBudget({ inputs }) }) ?? '';
    expect(full).toContain('$');
    expect(tight).not.toContain('Rates are published');
    expect(tiny).toContain('more providers not shown.');
    expect(tiny).toMatch(/^1\. anthropic: /m);
  });

  it('is left out when even one provider does not fit the budget', () => {
    const inputs = candidateInputsOf({ on: ['anthropic', 'cursor', 'codex', 'gemini', 'copilot'] });
    expect(block({ inputs, budget: 10 })).toBeNull();
    expect(block({ inputs, budget: smallestBudget({ inputs }) - 1 })).toBeNull();
  });

  it('renders the pinned models of a role when the pins alone span two providers', () => {
    const text = block({
      inputs: candidateInputsOf({
        rolePins: {
          reviewer: {
            providerId: 'anthropic',
            model: 'opus-5.5',
            effort: 'high',
            models: [
              { providerId: 'anthropic', model: 'opus-5.5', effort: 'high' },
              { providerId: 'codex', model: 'gpt-6.1-sol', effort: 'medium' },
            ],
          },
        },
      }),
      roles: ['reviewer'],
    });
    expect(text).toContain(
      'Pinned roles take only these models: reviewer anthropic/opus-5.5 high, codex/gpt-6.1-sol medium.',
    );
  });

  it('is left out when only one provider can take new agents', () => {
    expect(block({ inputs: candidateInputsOf({ on: ['anthropic'] }) })).toBeNull();
    expect(block({ inputs: candidateInputsOf({ coolingDown: ['cursor', 'codex'] }) })).toBeNull();
  });

  it('names the rule in plain words', () => {
    expect(block({ inputs: candidateInputsOf({}) })).toContain(
      'Provider priority: by order. Your provider order wins when several fit',
    );
    expect(block({ inputs: candidateInputsOf({ rule: 'load' }) })).toContain(
      'Provider priority: by load. The provider with the most room left wins',
    );
  });

  it('states the guards that depend on the role', () => {
    const text = block({ inputs: candidateInputsOf({}) });
    expect(text).toContain(
      'Agents that write code (implementer, tester, docs, scribe, ci-fixer, rewriter) run on anthropic and codex only.',
    );
    expect(text).toContain('A reviewer of a change runs on another model family');
    expect(text).toContain('Only anthropic agents keep their session after a question');
  });

  it('names a provider that cannot take new agents right now and why', () => {
    const text = block({
      inputs: candidateInputsOf({
        on: ['anthropic', 'cursor', 'codex', 'gemini'],
        coolingDown: ['gemini'],
      }),
    });
    expect(text).toContain('Not available now: gemini (cooling down after a limit).');
    expect(text).not.toMatch(/^\d\. gemini/m);
  });

  it('lists the pinned models of a role apart from the table', () => {
    const text = block({
      inputs: candidateInputsOf({
        rolePins: { reviewer: { providerId: 'anthropic', model: 'opus-5.5', effort: 'high' } },
      }),
    });
    expect(text).toContain(
      'Pinned roles take only these models: reviewer anthropic/opus-5.5 high.',
    );
  });

  it('shows the best candidate of every role and size, so the Lead can always pick it', () => {
    const inputs = candidateInputsOf({ on: ['anthropic', 'cursor', 'codex', 'gemini'] });
    const text = block({ inputs }) ?? '';
    for (const role of AUTO_DELEGATION_ROLES) {
      for (const size of SIZES) {
        const best = bestCandidate({
          list: buildCandidates({ inputs, need: { role, size, scope: 'helper' } }),
        });
        expect(best).not.toBeNull();
        expect(text).toContain(`${best?.model}${best?.effort == null ? '' : ` ${best.effort}`}`);
      }
    }
  });
});
