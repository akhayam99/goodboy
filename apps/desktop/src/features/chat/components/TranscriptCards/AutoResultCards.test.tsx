// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { AutoOutcome } from '@goodboy/db';
import { brandId, type AgentId, type ProviderRunId } from '@goodboy/types';
import type { AutoDeliveredResult } from '../../../../store/slices/auto-view/state';
import { declaredOutcomeLineOf } from '../../../auto/chat/declaredOutcomeLineOf';
import type { ArtifactLinkModel } from '../../../auto/chat/artifactLinksOf';
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
  outcomeLine: declaredOutcomeLineOf({ summary, outcome }),
  artifacts: [],
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

type RenderParams = {
  readonly results: ReadonlyArray<AutoDeliveredResult>;
  readonly artifacts?: ReadonlyMap<string, ReadonlyArray<ArtifactLinkModel>>;
  readonly onOpenChild?: () => void;
  readonly onOpenArtifact?: () => void;
};

const renderCardsWith = ({
  results,
  artifacts = new Map(),
  onOpenChild = vi.fn(),
  onOpenArtifact = vi.fn(),
}: RenderParams) =>
  render(
    <AutoResultCards
      results={results}
      labels={LABELS}
      artifacts={artifacts}
      onOpenChild={onOpenChild}
      onOpenArtifact={onOpenArtifact}
    />,
  );

const renderCards = (results: ReadonlyArray<AutoDeliveredResult>, onOpenChild = vi.fn()) =>
  renderCardsWith({ results, onOpenChild });

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

  describe('when the agent produced an artifact', () => {
    const NARRATION = [
      'Comparing the ledger-core branch against main.',
      '',
      'Checking the insert path for concurrent webhooks.',
      '',
      'One race left in ledger-core.',
    ].join('\n');

    const REPORT_LINK: ArtifactLinkModel = {
      artifactId: 'artifact-report',
      kind: 'report',
      kindLabel: 'Report',
      title: 'Certify ledger-core, branch vs main',
      revision: 2,
      lead: 'One race left in ledger-core, the rest is safe to merge.',
      approval: null,
    };

    const reviewerResult = (): AutoDeliveredResult => ({
      ...resultOf({ key: 'first', role: 'reviewer', outcome: 'completed', summary: NARRATION }),
      artifacts: [
        {
          artifactId: 'artifact-report',
          kind: 'report',
          title: 'Certify ledger-core, branch vs main',
          revision: 2,
        },
      ],
    });

    it('leads with the artifact row and keeps the notes closed', () => {
      const onOpenArtifact = vi.fn();
      renderCardsWith({
        results: [reviewerResult()],
        artifacts: new Map([['delegation-first', [REPORT_LINK]]]),
        onOpenArtifact,
      });

      const card = screen.getByRole('article', { name: 'Reviewer 1, Done' });
      const row = within(card).getByRole('button', {
        name: 'Open report Certify ledger-core, branch vs main',
      });
      expect(row.textContent).toContain('Report · Certify ledger-core, branch vs main');
      within(card).getByText('v2');
      within(card).getByText('One race left in ledger-core, the rest is safe to merge.');
      expect(within(card).queryByText(/Comparing the ledger-core branch/)).toBeNull();
      const notes = within(card).getByRole('button', { name: 'Notes, 3 lines' });
      expect(notes.getAttribute('aria-expanded')).toBe('false');
      expect(card.querySelector('[data-clamped]')).toBeNull();
      fireEvent.click(row);
      expect(onOpenArtifact).toHaveBeenCalledWith('artifact-report');
    });

    it('opens the notes on demand', () => {
      renderCardsWith({
        results: [reviewerResult()],
        artifacts: new Map([['delegation-first', [REPORT_LINK]]]),
      });

      fireEvent.click(screen.getByRole('button', { name: 'Notes, 3 lines' }));

      const notes = screen.getByRole('button', { name: 'Notes, 3 lines' });
      expect(notes.getAttribute('aria-expanded')).toBe('true');
      screen.getByText(/Comparing the ledger-core branch/);
    });

    it('draws no row for a plan that waits for approval and keeps the notes closed', () => {
      const waiting: ArtifactLinkModel = {
        ...REPORT_LINK,
        artifactId: 'artifact-plan',
        kind: 'plan',
        kindLabel: 'Plan',
        title: 'Retry-safe credit retries',
        approval: { word: 'Needs approval', tone: 'warning', state: 'needs_approval' },
      };
      renderCardsWith({
        results: [reviewerResult()],
        artifacts: new Map([['delegation-first', [waiting]]]),
      });

      expect(screen.queryByRole('list', { name: 'Artifacts' })).toBeNull();
      screen.getByRole('button', { name: 'Notes, 3 lines' });
    });

    it('leads with the model outcome line and shows no state word beside the title', () => {
      const summary = `<<outcome>>Changes needed: 1 blocker<</outcome>>\n${NARRATION}`;
      const withLine: AutoDeliveredResult = {
        ...reviewerResult(),
        summary,
        outcomeLine: declaredOutcomeLineOf({ summary, outcome: 'completed' }),
      };
      renderCardsWith({
        results: [withLine],
        artifacts: new Map([['delegation-first', [REPORT_LINK]]]),
      });

      const card = screen.getByRole('article', { name: 'Reviewer 1, Done' });
      const outcome = within(card).getByTestId('outcome-line');
      expect(outcome.textContent).toBe('Changes needed: 1 blocker');
      expect(card.textContent).not.toContain('<<outcome>>');
      expect(within(card).queryByText('Done')).toBeNull();
      within(card).getByRole('button', { name: 'Notes, 3 lines' });
    });

    it('marks an approved plan with its tone word', () => {
      const approved: ArtifactLinkModel = {
        ...REPORT_LINK,
        artifactId: 'artifact-plan',
        kind: 'plan',
        kindLabel: 'Plan',
        title: 'Retry-safe credit retries',
        revision: 1,
        approval: { word: 'Approved', tone: 'success', state: 'approved' },
      };
      renderCardsWith({
        results: [reviewerResult()],
        artifacts: new Map([['delegation-first', [approved]]]),
      });

      screen.getByRole('button', { name: 'Open plan Retry-safe credit retries' });
      screen.getByText('Approved');
    });

    it('drops the notes when the summary is only an artifact block', () => {
      const blockOnly: AutoDeliveredResult = {
        ...reviewerResult(),
        summary: '<<artifact v=1 kind=report>>\n{"title":"Audit"}\n<</artifact>>',
      };
      renderCardsWith({
        results: [blockOnly],
        artifacts: new Map([['delegation-first', [REPORT_LINK]]]),
      });

      expect(screen.queryByRole('button', { name: /^Notes, / })).toBeNull();
      screen.getByRole('button', { name: /^Open report/ });
    });
  });

  it('keeps the text preview and no notes toggle for an agent with no artifact', () => {
    renderCards([
      resultOf({ key: 'first', role: 'reviewer', outcome: 'completed', summary: LONG_REPORT }),
    ]);

    const card = screen.getByRole('article', { name: 'Reviewer 1, Done' });
    expect(within(card).queryByRole('button', { name: /^Notes, / })).toBeNull();
    expect(within(card).queryByRole('list', { name: 'Artifacts' })).toBeNull();
    expect(card.querySelector('[data-clamped="true"]')).not.toBeNull();
    within(card).getByRole('button', { name: 'Show more' });
  });
});
