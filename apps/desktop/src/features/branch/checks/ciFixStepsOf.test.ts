import { describe, expect, it } from 'vitest';
import type { Agent } from '@goodboy/types';
import type { CheckChain } from '../../../store/slices/agents/selectCheckChain';
import { ciFixStepsOf } from './ciFixStepsOf';

const AGENT: Agent = JSON.parse(
  JSON.stringify({ id: 'mock-agent', name: 'CI fix', status: 'completed' }),
);

const chainOf = (overrides: Partial<CheckChain>): CheckChain => ({
  state: 'proposal',
  debugger: AGENT,
  fix: null,
  proposal: 'Add a guard',
  commit: null,
  commitCount: 0,
  isDismissed: false,
  ...overrides,
});

type RowsParams = {
  readonly chain: CheckChain;
  readonly checkOutcome?: 'running' | 'passed' | 'failed';
};

const rowsOf = ({ chain, checkOutcome = 'running' }: RowsParams) =>
  ciFixStepsOf({ chain, checkName: 'payments-api / test', checkOutcome }).map(
    (step) => `${step.name}:${step.detail}`,
  );

describe('ciFixStepsOf', () => {
  it('waits for the user on a proposal', () => {
    expect(rowsOf({ chain: chainOf({}) })).toEqual(['Proposal:Waiting for you', 'Fix:Not started']);
  });
  it('shows only the analysis while it runs or found nothing', () => {
    expect(rowsOf({ chain: chainOf({ state: 'analyzing', proposal: null }) })).toEqual([
      'Analyze:Running',
    ]);
    expect(rowsOf({ chain: chainOf({ state: 'no-fix', proposal: null }) })).toEqual([
      'Analyze:No fix proposed',
    ]);
  });
  it('asks for the push once the fix is local', () => {
    expect(rowsOf({ chain: chainOf({ state: 'fixed-local', fix: AGENT }) })).toEqual([
      'Analyze:Done',
      'Fix:Done',
      'Push:Needs you',
    ]);
  });
  it.each([
    ['running', 'Running'],
    ['passed', 'Passed'],
    ['failed', 'Still failing'],
  ] as const)('ends on the check when the push is done and it is %s', (checkOutcome, detail) => {
    expect(rowsOf({ chain: chainOf({ state: 'fixed-pushed', fix: AGENT }), checkOutcome })).toEqual(
      ['Analyze:Done', 'Fix:Done', 'Push:Done', `payments-api / test:${detail}`],
    );
  });
  it('keeps a dismissed proposal as dismissed', () => {
    expect(rowsOf({ chain: chainOf({ state: 'no-fix', isDismissed: true }) })).toEqual([
      'Proposal:Dismissed',
      'Fix:Not started',
    ]);
  });
});
