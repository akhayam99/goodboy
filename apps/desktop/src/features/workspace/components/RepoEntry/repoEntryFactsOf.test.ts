import { describe, expect, it } from 'vitest';
import type { BaseDivergence, WorkspaceId } from '@goodboy/types';
import { brandId } from '@goodboy/types';
import { aProject } from '@goodboy/types/testing';
import { repoEntryCardOf } from './repoEntryCardOf';
import { repoEntryFactsOf } from './repoEntryFactsOf';

const WORKSPACE = brandId<WorkspaceId>({ value: 'ws-harborline' });
const PAYMENTS = aProject({ workspaceId: WORKSPACE, name: 'payments-api', kind: 'repo' });
const RELAY = aProject({ workspaceId: WORKSPACE, name: 'notify-relay', kind: 'repo' });
const LEDGER = aProject({ workspaceId: WORKSPACE, name: 'ledger-core', kind: 'repo' });

type ReportParams = {
  readonly state: BaseDivergence['state'];
  readonly behind?: number;
};

const reportOf = ({ state, behind = 0 }: ReportParams): BaseDivergence => ({
  state,
  base: 'main',
  upstream: 'origin/main',
  ahead: 0,
  behind,
  checkoutBranch: 'main',
  uncommitted: 0,
  message: null,
});

describe('repoEntryFactsOf', () => {
  it('returns one row per repo that needs a look, not a joined string', () => {
    const facts = repoEntryFactsOf({
      entries: [
        { project: PAYMENTS, report: reportOf({ state: 'behind', behind: 3 }) },
        { project: LEDGER, report: reportOf({ state: 'diverged', behind: 2 }) },
        { project: RELAY, report: reportOf({ state: 'up-to-date' }) },
      ],
    });

    expect(facts.rows).toEqual([
      { label: 'payments-api', value: '3 behind', note: 'main', tone: 'info' },
      { label: 'ledger-core', value: 'Diverged', note: 'origin/main', tone: 'warning' },
    ]);
  });

  it('has no rows and a one sentence summary when nothing needs a pull', () => {
    const facts = repoEntryFactsOf({
      entries: [{ project: PAYMENTS, report: reportOf({ state: 'up-to-date' }) }],
    });

    expect(facts.rows).toEqual([]);
    expect(facts.summary).toBe('1 repo, nothing to pull from origin');
  });

  it('says it is still checking before any report arrived', () => {
    const facts = repoEntryFactsOf({ entries: [{ project: PAYMENTS, report: undefined }] });

    expect(facts.summary).toBe('1 repo, checking origin');
  });
});

describe('repoEntryCardOf', () => {
  it('says the summary as the state when no repo needs a look', () => {
    const facts = repoEntryFactsOf({
      entries: [{ project: PAYMENTS, report: reportOf({ state: 'up-to-date' }) }],
    });
    const card = repoEntryCardOf({ facts, repoCount: 1 });

    expect(card.facts).toEqual([]);
    expect(card.state?.words).toBe('1 repo, nothing to pull from origin');
  });

  it('keeps five rows and says how many more when a workspace has many repos', () => {
    const entries = Array.from({ length: 8 }, (_, index) => ({
      project: aProject({ workspaceId: WORKSPACE, name: `service-${index}`, kind: 'repo' }),
      report: reportOf({ state: 'behind', behind: index + 1 }),
    }));
    const card = repoEntryCardOf({ facts: repoEntryFactsOf({ entries }), repoCount: 8 });

    expect(card.facts).toHaveLength(5);
    expect(card.footnote).toBe('and 3 more');
    expect(card.sub).toBe('8 repos');
  });
});
