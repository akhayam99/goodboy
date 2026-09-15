// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { tintClasses } from '@goodboy/ui';
import type { AgentId, PlanId, PlanWithCount, SessionId } from '@goodboy/types';
import { CONCEPT_TONE } from '../../../../shared/components/conceptIcons';

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

  it('falls back to the use count when the plan was never consumed', () => {
    render(<AgentBriefPlans plans={[makePlan({ consumptionCount: 0 })]} sessionId={sessionId} />);

    expect(screen.getByText('active · 0 uses')).toBeDefined();
  });

  it('names the consumer instead of counting the uses', () => {
    render(
      <AgentBriefPlans
        plans={[
          makePlan({
            status: 'consumed',
            consumptionCount: 1,
            lastConsumer: { agentId: 'agent-9' as AgentId, name: 'implementer' },
          }),
        ]}
        sessionId={sessionId}
      />,
    );

    expect(screen.getByText('consumed · Run by implementer')).toBeDefined();
  });

  it('adds the remainder when the plan ran several times', () => {
    render(
      <AgentBriefPlans
        plans={[
          makePlan({
            status: 'consumed',
            consumptionCount: 3,
            lastConsumer: { agentId: 'agent-9' as AgentId, name: 'implementer' },
          }),
        ]}
        sessionId={sessionId}
      />,
    );

    expect(screen.getByText('consumed · Run by implementer +2 more')).toBeDefined();
  });

  it('falls back to a truncated id when the consumer agent is gone', () => {
    render(
      <AgentBriefPlans
        plans={[
          makePlan({
            status: 'consumed',
            consumptionCount: 1,
            lastConsumer: { agentId: 'agent-9f3c2b1a' as AgentId, name: null },
          }),
        ]}
        sessionId={sessionId}
      />,
    );

    expect(screen.getByText('consumed · Run by agent-9f')).toBeDefined();
  });

  it('renders each plan with the shared plan tone', () => {
    render(<AgentBriefPlans plans={[makePlan({})]} sessionId={sessionId} />);

    const card = screen.getByRole('button', { name: /Implement chat surface/ });
    const planTint = tintClasses(CONCEPT_TONE.plans);
    expect(card.className).toContain(planTint.bgSoft);
    expect(card.className).toContain(planTint.borderSoft);
  });
});
