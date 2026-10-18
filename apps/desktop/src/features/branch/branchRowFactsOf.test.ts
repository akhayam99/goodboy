import { describe, expect, it } from 'vitest';
import type { MountPullRequestProvider, PrCheckRun, PullRequestStateKind } from '@goodboy/types';
import type { MountRequestView } from '../../store/slices/project-mounts/mountRowModel';
import { branchRowFactsOf } from './branchRowFactsOf';

const run = (conclusion: PrCheckRun['conclusion']): PrCheckRun => ({
  name: 'unit tests',
  conclusion,
  detailsUrl: null,
  durationMs: null,
});

type RequestParams = {
  readonly provider?: MountPullRequestProvider;
  readonly state?: PullRequestStateKind;
  readonly title?: string;
};

const requestOf = ({
  provider = 'github',
  state = 'open',
  title = 'Stop retried webhooks posting a second credit',
}: RequestParams = {}): MountRequestView => ({
  provider,
  identity: null,
  number: 318,
  state,
  isDraft: false,
  checks: null,
  reviewDecision: null,
  url: 'https://example.invalid/318',
  title,
  label: 'PR #318',
});

const BASE = {
  branch: 'hl/fix-duplicate-credit',
  mountName: 'payments-api',
  request: requestOf(),
  checks: null,
  behind: null,
  conflicts: null,
} satisfies Parameters<typeof branchRowFactsOf>[0];

const STATES: ReadonlyArray<readonly [PullRequestStateKind, string]> = [
  ['queued', 'Queued'],
  ['approved', 'Approved'],
  ['open', 'Open'],
  ['draft', 'Draft'],
  ['merged', 'Merged'],
  ['closed', 'Closed'],
];

describe('the facts of a branch row', () => {
  it('titles the row with the pull request title, else the branch name', () => {
    expect(branchRowFactsOf(BASE).title).toBe('Stop retried webhooks posting a second credit');
    expect(branchRowFactsOf(BASE).isBranchTitle).toBe(false);
    const bare = branchRowFactsOf({ ...BASE, request: null });
    expect(bare.title).toBe('hl/fix-duplicate-credit');
    expect(bare.isBranchTitle).toBe(true);
    expect(branchRowFactsOf({ ...BASE, request: requestOf({ title: '  ' }) }).title).toBe(
      'hl/fix-duplicate-credit',
    );
    expect(branchRowFactsOf({ ...BASE, branch: '', request: null }).title).toBe('payments-api');
  });

  it('says Open for an open pull request, the same word the rest of the app uses', () => {
    expect(branchRowFactsOf(BASE).stateWord).toBe('Open');
  });

  it.each(STATES)('reads the %s state as %s on every host', (state, word) => {
    for (const provider of ['github', 'gitlab', 'bitbucket'] as const) {
      const facts = branchRowFactsOf({ ...BASE, request: requestOf({ provider, state }) });
      expect(facts.state).toBe(state);
      expect(facts.stateWord).toBe(word);
      expect(facts.host).toBe(provider);
    }
  });

  it('writes the number with the host prefix and keeps the host name out of the visible facts', () => {
    const gitlab = branchRowFactsOf({ ...BASE, request: requestOf({ provider: 'gitlab' }) });
    expect(gitlab.number).toBe('!318');
    expect(branchRowFactsOf(BASE).number).toBe('#318');
    expect(gitlab.hostName).toBe('GitLab');
    const visible = [gitlab.title, gitlab.number, gitlab.stateWord, gitlab.signal?.text];
    expect(visible.join(' ')).not.toMatch(/GitHub|GitLab|Bitbucket/);
  });

  it('has no number, host or state word without a pull request', () => {
    const facts = branchRowFactsOf({ ...BASE, request: null });
    expect(facts.number).toBeNull();
    expect(facts.host).toBeNull();
    expect(facts.hostName).toBeNull();
    expect(facts.stateWord).toBeNull();
    expect(facts.state).toBe('none');
  });

  it('ranks queued, approved, open, draft, none, then merged and closed', () => {
    const rankOf = (state: PullRequestStateKind | 'none'): number =>
      branchRowFactsOf({
        ...BASE,
        request: state === 'none' ? null : requestOf({ state }),
      }).rank;
    const order = ['queued', 'approved', 'open', 'draft', 'none', 'merged', 'closed'] as const;
    const ranks = order.map(rankOf);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(new Set(ranks).size).toBe(order.length);
  });

  it('marks merged and closed as finished and gives them no signal', () => {
    const merged = branchRowFactsOf({
      ...BASE,
      request: requestOf({ state: 'merged' }),
      checks: [run('failure')],
      behind: 4,
      conflicts: 2,
    });
    expect(merged.isFinished).toBe(true);
    expect(merged.signal).toBeNull();
    expect(branchRowFactsOf(BASE).isFinished).toBe(false);
  });

  it('shows the one signal worst first: failing, then conflict, then behind', () => {
    const all = { checks: [run('failure'), run('failure')], conflicts: 2, behind: 6 };
    expect(branchRowFactsOf({ ...BASE, ...all }).signal).toEqual({
      kind: 'failing',
      tone: 'danger',
      text: '2 failing',
    });
    expect(branchRowFactsOf({ ...BASE, ...all, checks: [run('success')] }).signal).toEqual({
      kind: 'conflict',
      tone: 'warning',
      text: 'Conflict',
    });
    expect(
      branchRowFactsOf({ ...BASE, ...all, checks: [run('success')], conflicts: 0 }).signal,
    ).toEqual({ kind: 'behind', tone: 'warning', text: '6 behind' });
  });

  it('shows no signal for running checks, a clean branch or an unknown distance', () => {
    expect(branchRowFactsOf({ ...BASE, checks: [run('pending')] }).signal).toBeNull();
    expect(branchRowFactsOf({ ...BASE, behind: 0, conflicts: 0 }).signal).toBeNull();
    expect(branchRowFactsOf(BASE).signal).toBeNull();
  });

  it('counts the checks of GitLab and Bitbucket the way GitHub does, skipped apart from passed', () => {
    const checks = [run('success'), run('success'), run('skipped'), run('failure'), run('pending')];
    for (const provider of ['github', 'gitlab', 'bitbucket'] as const) {
      const facts = branchRowFactsOf({
        ...BASE,
        request: requestOf({ provider }),
        checks,
      });
      expect(facts.checks).toEqual({ failing: 1, running: 1, passed: 2, skipped: 1 });
      expect(facts.signal?.text).toBe('1 failing');
    }
  });

  it('falls back to the rolled-up failure when the runs are not read, without inventing a count', () => {
    const request = { ...requestOf({ provider: 'bitbucket' }), checks: 'failure' } as const;
    const facts = branchRowFactsOf({ ...BASE, request });
    expect(facts.checks).toBeNull();
    expect(facts.signal?.text).toBe('Failing');
  });

  it('reads aloud the title, number, state, branch and signal', () => {
    expect(branchRowFactsOf({ ...BASE, checks: [run('failure')] }).label).toBe(
      'Stop retried webhooks posting a second credit, #318, Open, branch hl/fix-duplicate-credit, 1 failing',
    );
    expect(branchRowFactsOf({ ...BASE, request: null }).label).toBe('hl/fix-duplicate-credit');
  });
});
