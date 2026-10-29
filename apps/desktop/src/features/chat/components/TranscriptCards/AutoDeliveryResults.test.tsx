// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { brandId, type AgentId, type IsoDateTime, type ProviderRunId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { AutoDeliveredResult } from '../../../../store/slices/auto-view/state';
import { declaredOutcomeLineOf } from '../../../auto/chat/declaredOutcomeLineOf';
import { aDelegation, aView, FIXTURE_SESSION } from '../../../auto/testing/autoViewFixtures';
import { TranscriptCard } from '.';

afterEach(() => {
  cleanup();
  useAppStore.setState({ autoTreeViews: {} });
});

const RUN_ONE = brandId<ProviderRunId>({ value: 'run-auto-1' });
const RUN_TWO = brandId<ProviderRunId>({ value: 'run-auto-2' });

type ResultParams = {
  readonly key: string;
  readonly runId: ProviderRunId;
  readonly summary: string;
};

const resultOf = ({ key, runId, summary }: ResultParams): AutoDeliveredResult => ({
  runId,
  delegationId: `delegation-${key}`,
  childAgentId: brandId<AgentId>({ value: `agent-${key}` }),
  role: 'reviewer',
  provider: 'anthropic',
  model: 'claude-sonnet-5-5',
  outcome: 'completed',
  summary,
  outcomeLine: declaredOutcomeLineOf({ summary, outcome: 'completed' }),
  artifacts: [],
});

const seed = () =>
  useAppStore.setState({
    autoTreeViews: {
      [FIXTURE_SESSION]: [
        aView({
          phase: 'done',
          delegations: [
            aDelegation({ key: 'review-a', role: 'reviewer', state: 'settled' }),
            aDelegation({ key: 'review-b', role: 'reviewer', state: 'settled' }),
          ],
          deliveredResults: [
            resultOf({ key: 'review-a', runId: RUN_ONE, summary: 'No blocking issues.' }),
            resultOf({ key: 'review-b', runId: RUN_TWO, summary: 'One race in applyCredit.' }),
          ],
        }),
      ],
    },
  });

type DeliveryParams = {
  readonly runId: ProviderRunId;
  readonly hasSession?: boolean;
};

const renderDelivery = ({ runId, hasSession = true }: DeliveryParams) =>
  render(
    <TranscriptCard
      sessionId={hasSession ? FIXTURE_SESSION : null}
      item={{
        kind: 'auto_delivery',
        key: `auto-delivery-${runId}`,
        runId,
        text: 'RESULTS FROM YOUR AGENTS',
        at: brandId<IsoDateTime>({ value: '2026-10-17T10:11:40.000Z' }),
      }}
    />,
  );

describe('AutoDeliveryResults', () => {
  it('shows under a delivery only the results that run read, in their agent cards', () => {
    seed();
    renderDelivery({ runId: RUN_TWO });

    const cards = screen.getByRole('list', { name: 'What the agents reported' });
    expect(
      within(cards)
        .getAllByRole('article')
        .map((card) => card.getAttribute('aria-label')),
    ).toEqual(['work for review-b, Done']);
    expect(within(cards).getByText('One race in applyCredit.')).toBeDefined();
    expect(screen.queryByText('No blocking issues.')).toBeNull();
  });

  it('draws the red outcome a result carries over the model Done', () => {
    useAppStore.setState({
      autoTreeViews: {
        [FIXTURE_SESSION]: [
          aView({
            phase: 'done',
            delegations: [aDelegation({ key: 'review-a', role: 'reviewer', state: 'settled' })],
            deliveredResults: [
              {
                ...resultOf({ key: 'review-a', runId: RUN_ONE, summary: 'Done' }),
                outcomeLine: { text: 'Checks failed: 1', tone: 'danger', source: 'facts' },
              },
            ],
          }),
        ],
      },
    });
    renderDelivery({ runId: RUN_ONE });

    expect(screen.getByTestId('outcome-line').textContent).toBe('Checks failed: 1');
  });

  it('draws no cards under a delivery that read no results', () => {
    seed();
    renderDelivery({ runId: brandId<ProviderRunId>({ value: 'run-auto-3' }) });

    expect(screen.getByText('What Auto was told')).toBeDefined();
    expect(screen.queryByRole('list', { name: 'What the agents reported' })).toBeNull();
  });

  it('keeps the delivery row alone outside a session', () => {
    seed();
    renderDelivery({ runId: RUN_ONE, hasSession: false });

    expect(screen.queryByRole('article')).toBeNull();
  });
});
