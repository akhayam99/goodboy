// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useAppStore } from '../../../store';
import { registerDelegationDecisionPort } from '../delegationDecisionPort';
import { aDelegation, aPlanRow, aView } from '../testing/autoViewFixtures';
import { artifactLinksOf } from './artifactLinksOf';
import { DelegationBatch } from './DelegationBatch';
import { DelegationCard } from './DelegationCard';
import { delegationCardOf } from './delegationCardOf';

afterEach(cleanup);

const SETTLED_PLAN = aDelegation({
  key: 'planner',
  role: 'planner',
  state: 'settled',
  outcome: 'completed',
  settledAt: 1_000,
  result: {
    declared: { summary: 'A three part plan.' },
    artifacts: [
      { id: 'artifact-plan', kind: 'plan', title: 'Retry-safe credit retries', revision: 1 },
    ],
    cost: { usd: 0.12, basis: 'reported' },
  },
});

describe('DelegationCard', () => {
  it('draws a running child with its role, model, reason, live status and reserved ceiling', () => {
    const card = delegationCardOf({
      delegation: aDelegation({
        key: 'impl',
        role: 'implementer',
        state: 'running',
        reason: 'Mechanical change from an approved plan.',
      }),
      childAgent: null,
    });

    render(<DelegationCard card={card} links={[]} onOpenChat={vi.fn()} onOpenArtifact={vi.fn()} />);

    const article = screen.getByRole('article', { name: 'Implementer delegation' });
    expect(within(article).getByText('Running')).toBeDefined();
    expect(within(article).getByText('Mechanical change from an approved plan.')).toBeDefined();
    expect(within(article).getByText('Reserved up to $3.00')).toBeDefined();
    expect(within(article).queryByText('Returned to Auto')).toBeNull();
  });

  it('draws a settled child with its result, the plan link with approval, cost and Open chat', () => {
    const view = aView({ phase: 'waiting', delegations: [SETTLED_PLAN], artifacts: [aPlanRow()] });
    const onOpenChat = vi.fn();
    const onOpenArtifact = vi.fn();
    const card = delegationCardOf({ delegation: SETTLED_PLAN, childAgent: null });

    render(
      <DelegationCard
        card={card}
        links={artifactLinksOf({ view, card })}
        onOpenChat={onOpenChat}
        onOpenArtifact={onOpenArtifact}
      />,
    );

    expect(screen.getByText('A three part plan.')).toBeDefined();
    expect(screen.getByText('Done')).toBeDefined();
    expect(screen.getByText('Returned to Auto')).toBeDefined();
    expect(screen.getByText('$0.12')).toBeDefined();
    const link = screen.getByRole('button', { name: 'Open plan Retry-safe credit retries' });
    expect(within(link).getByText('Needs approval')).toBeDefined();
    expect(within(link).getByText('v1')).toBeDefined();
    fireEvent.click(link);
    expect(onOpenArtifact).toHaveBeenCalledWith('artifact-plan');
    fireEvent.click(screen.getByRole('button', { name: 'Open chat' }));
    expect(onOpenChat).toHaveBeenCalledWith(
      expect.objectContaining({ childAgentId: 'agent-planner' }),
    );
  });

  it('says why a child failed and keeps the way to its chat', () => {
    const failed = aDelegation({
      key: 'impl',
      role: 'implementer',
      state: 'settled',
      outcome: 'timed_out',
      result: { reason: 'deadline_passed' },
    });

    render(
      <DelegationCard
        card={delegationCardOf({ delegation: failed, childAgent: null })}
        links={[]}
        onOpenChat={vi.fn()}
        onOpenArtifact={vi.fn()}
      />,
    );

    expect(screen.getByText('Timed out')).toBeDefined();
    expect(screen.getByText('It ran out of time.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Open chat' })).toBeDefined();
  });

  it('shows a revision as the same producer, revising and then ready', () => {
    const revising = aDelegation({
      key: 'planner',
      role: 'planner',
      state: 'running',
      reviseOf: 'artifact-plan',
      baseRevision: 1,
    });
    const view = aView({
      phase: 'waiting',
      delegations: [revising],
      artifacts: [aPlanRow({ approvalState: 'revising', openRevise: 'delegation-planner' })],
    });

    render(
      <DelegationBatch
        view={view}
        delegations={[revising]}
        agents={[]}
        onOpenAgent={vi.fn()}
        onOpenArtifact={vi.fn()}
      />,
    );

    expect(screen.getByRole('article', { name: 'Planner, revising v2 delegation' })).toBeDefined();
  });
});

const REVISE_ASKING = aDelegation({
  key: 'planner-2',
  role: 'planner',
  state: 'awaiting_confirm',
  reviseOf: 'artifact-plan',
  baseRevision: 2,
});

const renderAsking = () =>
  render(
    <DelegationBatch
      view={aView({
        phase: 'waiting',
        delegations: [REVISE_ASKING],
        artifacts: [{ ...aPlanRow({ revision: 2 }), title: 'Retry-safe credit retries' }],
      })}
      delegations={[REVISE_ASKING]}
      agents={[]}
      onOpenAgent={vi.fn()}
      onOpenArtifact={vi.fn()}
    />,
  );

describe('the confirm row of a delegation that waits for an OK', () => {
  afterEach(() => registerDelegationDecisionPort({ port: null }));

  it('names the plan and version it would change and offers Confirm and Cancel', () => {
    renderAsking();

    expect(screen.getByText('Change plan Retry-safe credit retries at v2?')).toBeDefined();
    expect(screen.getByText('Needs your OK')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDefined();
  });

  it('sends the answer once to the port and leaves the card to the next read', async () => {
    const port = vi.fn(async () => 'confirmed' as const);
    registerDelegationDecisionPort({ port });
    renderAsking();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(port).toHaveBeenCalledOnce());
    expect(port).toHaveBeenCalledWith({
      delegationId: 'delegation-planner-2',
      decision: 'confirm',
    });
  });

  it('sends a decline for Cancel', async () => {
    const port = vi.fn(async () => 'declined' as const);
    registerDelegationDecisionPort({ port });
    renderAsking();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() =>
      expect(port).toHaveBeenCalledWith({
        delegationId: 'delegation-planner-2',
        decision: 'decline',
      }),
    );
  });

  it('says so when the question is no longer open and when no window can take the answer', async () => {
    const reportError = vi.fn(async () => undefined);
    useAppStore.setState({ reportError });
    registerDelegationDecisionPort({ port: async () => 'lost' });
    renderAsking();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(reportError).toHaveBeenCalledOnce());
    expect(reportError).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: 'Auto has already moved on' }),
    );

    registerDelegationDecisionPort({ port: null });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(reportError).toHaveBeenCalledTimes(2));
    expect(reportError).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "Couldn't answer Auto" }),
    );
  });

  it('reports a port that throws and frees the buttons again', async () => {
    const reportError = vi.fn(async () => undefined);
    useAppStore.setState({ reportError });
    registerDelegationDecisionPort({
      port: async () => {
        throw new Error('database is locked');
      },
    });
    renderAsking();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(reportError).toHaveBeenCalledOnce());
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Confirm' })).toHaveProperty('disabled', false),
    );
  });
});
