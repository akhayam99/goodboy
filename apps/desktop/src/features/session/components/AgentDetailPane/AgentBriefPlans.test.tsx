// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { PlanId, PlanWithCount, SessionId } from '@goodboy/types';

import { AgentBriefPlans } from './AgentBriefPlans';

const sessionId = 'session-1' as SessionId;

const makePlan = (over: Partial<PlanWithCount>): PlanWithCount =>
  ({
    id: 'plan-1' as PlanId,
    sessionId,
    agentId: 'agent-1',
    title: 'Implement chat surface',
    bodyMd: '',
    status: 'active',
    createdAt: '2026-05-15T00:00:00.000Z',
    updatedAt: '2026-05-15T00:00:00.000Z',
    consumptionCount: 0,
    ...over,
  }) as PlanWithCount;

afterEach(cleanup);

describe('AgentBriefPlans', () => {
  it('renders nothing when there are no plans', () => {
    const { container } = render(<AgentBriefPlans plans={[]} sessionId={sessionId} />);

    expect(container.firstChild).toBeNull();
  });

  it('keeps the singular use for a consumption count of one', () => {
    render(<AgentBriefPlans plans={[makePlan({ consumptionCount: 1 })]} sessionId={sessionId} />);

    expect(screen.getByText('active · 1 use')).toBeDefined();
  });

  it('pluralizes uses for a consumption count above one', () => {
    render(<AgentBriefPlans plans={[makePlan({ consumptionCount: 3 })]} sessionId={sessionId} />);

    expect(screen.getByText('active · 3 uses')).toBeDefined();
  });
});
