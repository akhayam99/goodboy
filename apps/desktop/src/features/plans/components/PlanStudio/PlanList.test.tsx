// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { PlanWithCount } from '@goodboy/types';
import { PlanList } from './PlanList';

afterEach(cleanup);

type PlanParams = {
  readonly id: string;
  readonly title: string;
  readonly status: PlanWithCount['status'];
};

const makePlan = ({ id, title, status }: PlanParams): PlanWithCount => ({
  id: id as never,
  sessionId: 'sess-1' as never,
  agentId: 'agent-1' as never,
  title,
  bodyMd: 'body',
  status,
  createdAt: '2026-01-05T10:00:00.000Z' as never,
  updatedAt: '2026-01-05T10:00:00.000Z' as never,
  consumptionCount: 0,
});

const plans: ReadonlyArray<PlanWithCount> = [
  makePlan({ id: 'plan-1', title: 'rounding pass on the ledger', status: 'active' }),
  makePlan({ id: 'plan-2', title: 'batch export drawer', status: 'consumed' }),
  makePlan({ id: 'plan-3', title: 'exception queue triage', status: 'consumed' }),
];

describe('PlanList', () => {
  it('lists the active plans and folds the finished ones behind one toggle row', () => {
    render(<PlanList plans={plans} openQuestionCount={0} onSelect={() => {}} />);

    expect(screen.getByText('rounding pass on the ledger')).toBeDefined();
    expect(screen.queryByText('batch export drawer')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Finished' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Show finished (2)' }));

    expect(screen.getByText('batch export drawer')).toBeDefined();
    expect(screen.getByText('exception queue triage')).toBeDefined();
  });
});
