// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { AutoOutcome } from '@goodboy/db';
import { brandId, type AgentId, type ProviderRunId } from '@goodboy/types';
import type { AutoDeliveredResult } from '../../../../store/slices/auto-view/state';
import { AutoResultCards } from './AutoResultCards';

afterEach(cleanup);

type ResultParams = {
  readonly key: string;
  readonly role: string;
  readonly outcome: AutoOutcome;
  readonly summary: string | null;
};

const resultOf = ({ key, role, outcome, summary }: ResultParams): AutoDeliveredResult => ({
  runId: brandId<ProviderRunId>({ value: 'run-auto-2' }),
  delegationId: `delegation-${key}`,
  childAgentId: brandId<AgentId>({ value: `agent-${key}` }),
  role,
  provider: 'anthropic',
  model: 'claude-sonnet-5-5',
  outcome,
  summary,
});

const LONG_REPORT = [
  'applyCredit can race two webhooks for the same event.',
  '',
  'The dedupe check reads the key before the insert.',
  '',
  'Two workers both pass the check.',
  '',
  'Both insert a credit row.',
  '',
  'Use one insert with a unique key instead.',
].join('\n');

const LABELS = new Map<AgentId, string>([
  [brandId<AgentId>({ value: 'agent-first' }), 'Reviewer 1'],
  [brandId<AgentId>({ value: 'agent-second' }), 'Reviewer 2'],
  [brandId<AgentId>({ value: 'agent-scout' }), 'Scout'],
  [brandId<AgentId>({ value: 'agent-stopped' }), 'Tester'],
]);

const renderCards = (results: ReadonlyArray<AutoDeliveredResult>, onOpenChild = vi.fn()) =>
  render(<AutoResultCards results={results} labels={LABELS} onOpenChild={onOpenChild} />);

describe('AutoResultCards', () => {
  it('wraps each report in the card of the agent that wrote it, with Open on the agent', () => {
    const onOpenChild = vi.fn();
    renderCards(
      [
        resultOf({
          key: 'first',
          role: 'reviewer',
          outcome: 'completed',
          summary: 'No blocking issues.',
        }),
        resultOf({ key: 'second', role: 'reviewer', outcome: 'completed', summary: LONG_REPORT }),
      ],
      onOpenChild,
    );

    const first = screen.getByRole('article', { name: 'Reviewer 1, Done' });
    expect(within(first).getByRole('img', { name: 'Reviewer' })).toBeDefined();
    expect(within(first).getByText('Reviewer 1')).toBeDefined();
    expect(within(first).getByText('No blocking issues.')).toBeDefined();
    expect(first.textContent).toContain('Sonnet');
    fireEvent.click(within(first).getByRole('button', { name: 'Open Reviewer 1' }));
    expect(onOpenChild).toHaveBeenCalledWith('agent-first');

    const second = screen.getByRole('article', { name: 'Reviewer 2, Done' });
    expect(within(second).queryByText('No blocking issues.')).toBeNull();
  });

  it('folds a long report to its first lines and opens it in place', () => {
    renderCards([
      resultOf({ key: 'second', role: 'reviewer', outcome: 'completed', summary: LONG_REPORT }),
    ]);

    const card = screen.getByRole('article', { name: 'Reviewer 2, Done' });
    const more = within(card).getByRole('button', { name: 'Show more' });
    expect(card.querySelector('[data-clamped="true"]')).not.toBeNull();
    fireEvent.click(more);
    expect(within(card).getByRole('button', { name: 'Show less' })).toBeDefined();
    expect(card.querySelector('[data-clamped="false"]')).not.toBeNull();
  });

  it('keeps the report of a blocked agent, since it says why it stopped', () => {
    renderCards([
      resultOf({
        key: 'scout',
        role: 'scout',
        outcome: 'blocked',
        summary: 'notify-relay is not mounted.',
      }),
    ]);

    const blocked = screen.getByRole('article', { name: 'Scout, Blocked' });
    expect(within(blocked).getByText('notify-relay is not mounted.')).toBeDefined();
  });

  it('shows a failed or stopped agent with its state and no report', () => {
    renderCards([
      resultOf({ key: 'scout', role: 'scout', outcome: 'failed', summary: 'crashed' }),
      resultOf({ key: 'stopped', role: 'tester', outcome: 'stopped', summary: 'half done' }),
    ]);

    const failed = screen.getByRole('article', { name: 'Scout, Failed' });
    expect(failed.getAttribute('data-outcome')).toBe('failed');
    expect(within(failed).queryByText('crashed')).toBeNull();
    expect(within(failed).getByRole('button', { name: 'Open Scout' })).toBeDefined();
    const stopped = screen.getByRole('article', { name: 'Tester, Stopped' });
    expect(within(stopped).queryByText('half done')).toBeNull();
  });
});
