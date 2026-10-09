// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { PrCheckRun, PrDetail, PullRequestState } from '@goodboy/types';
import { checksViewOf } from './checksViewOf';
import { repoNameOf } from './repoNameOf';

const PR: PullRequestState = {
  number: 318,
  title: 'Stop retried webhooks posting a second credit',
  url: 'https://github.com/harborline/payments-api/pull/318',
  state: 'open',
  mergeable: true,
  checks: null,
  baseBranch: 'main',
  headBranch: 'hl/fix-duplicate-credit',
  isDraft: false,
  reviewDecision: null,
  body: '',
  updatedAt: '2026-10-05T10:00:00Z',
};

const RUN: PrCheckRun = {
  name: 'build',
  conclusion: 'success',
  detailsUrl: null,
  durationMs: null,
};

const detail = (patch: Partial<PrDetail> = {}): PrDetail => ({
  prNumber: 318,
  comments: [],
  reviews: [],
  reviewRequests: [],
  checks: [RUN],
  ...patch,
});

const view = (patch: Partial<Parameters<typeof checksViewOf>[0]> = {}) =>
  checksViewOf({
    hostKind: 'github',
    hostUrl: null,
    pr: PR,
    detail: null,
    isDetailLoading: false,
    detailError: null,
    hasFetchedDetail: false,
    canReadChecks: false,
    portChecks: null,
    ...patch,
  });

describe('checksViewOf', () => {
  it('names GitLab and Bitbucket before it looks for a GitHub pull request', () => {
    expect(view({ hostKind: 'gitlab', hostUrl: 'https://gitlab.invalid/mr/1', pr: null })).toEqual({
      kind: 'host',
      host: 'gitlab',
      url: 'https://gitlab.invalid/mr/1',
    });
    expect(view({ hostKind: 'bitbucket', pr: null })).toEqual({
      kind: 'host',
      host: 'bitbucket',
      url: null,
    });
  });

  it('has no pull request, so nothing to read', () => {
    expect(view({ pr: null })).toEqual({ kind: 'no-pr' });
    expect(view({ hostKind: 'local', pr: null })).toEqual({ kind: 'no-pr' });
  });

  it('is loading, never empty, until a detail of this pull request arrives', () => {
    expect(view({ isDetailLoading: true })).toEqual({ kind: 'loading' });
    expect(view()).toEqual({ kind: 'loading' });
    expect(view({ detail: detail({ prNumber: 12 }) })).toEqual({ kind: 'loading' });
  });

  it('keeps the previous detail on screen while a refresh runs', () => {
    expect(view({ detail: detail(), isDetailLoading: true })).toEqual({
      kind: 'ready',
      checks: [RUN],
    });
  });

  it('is ready with the runs, or with none when the read worked', () => {
    expect(view({ detail: detail() })).toEqual({ kind: 'ready', checks: [RUN] });
    expect(view({ detail: detail({ checks: [] }) })).toEqual({ kind: 'ready', checks: [] });
  });

  it('reads a detail from before the read states existed as ok', () => {
    expect(view({ detail: detail({ checksRead: undefined }) }).kind).toBe('ready');
  });

  it('is denied with the stderr line, and failed with its own', () => {
    expect(view({ detail: detail({ checksRead: 'denied', checksError: 'saml' }) })).toEqual({
      kind: 'denied',
      error: 'saml',
    });
    expect(view({ detail: detail({ checksRead: 'failed', checksError: 'boom' }) })).toEqual({
      kind: 'failed',
      error: 'boom',
    });
  });

  it('is failed when the whole detail read failed, and that wins over an old detail', () => {
    expect(view({ detailError: 'spawn failed' })).toEqual({
      kind: 'failed',
      error: 'spawn failed',
    });
    expect(view({ detail: detail(), detailError: 'spawn failed' })).toEqual({
      kind: 'failed',
      error: 'spawn failed',
    });
  });

  it('does not show a failure while the retry is running', () => {
    expect(view({ detailError: 'spawn failed', isDetailLoading: true })).toEqual({
      kind: 'loading',
    });
  });

  it('is failed, not loading forever, when the read finished without a detail', () => {
    expect(view({ hasFetchedDetail: true })).toEqual({ kind: 'failed', error: null });
  });
});

describe('repoNameOf', () => {
  it('reads the repository from a GitHub pull request address', () => {
    expect(repoNameOf({ url: 'https://github.com/harborline/payments-api/pull/318' })).toBe(
      'payments-api',
    );
    expect(repoNameOf({ url: 'https://ghe.invalid/cascadia/ledger-core/pull/9' })).toBe(
      'ledger-core',
    );
  });

  it('reads the project from a GitLab merge request address, groups included', () => {
    expect(
      repoNameOf({ url: 'https://gitlab.com/harborline/payments-api/-/merge_requests/42' }),
    ).toBe('payments-api');
    expect(
      repoNameOf({
        url: 'https://gitlab.invalid/cascadia/platform/ledger-core/-/merge_requests/9',
      }),
    ).toBe('ledger-core');
  });

  it('reads the repository from a Bitbucket pull request address', () => {
    expect(
      repoNameOf({ url: 'https://bitbucket.org/harborline/payments-api/pull-requests/42' }),
    ).toBe('payments-api');
  });

  it('falls back to a plain phrase when the address has another shape', () => {
    expect(repoNameOf({ url: '' })).toBe('this repository');
    expect(repoNameOf({ url: 'https://example.invalid/a/b/issues/1' })).toBe('this repository');
  });
});

describe('checksViewOf on a host that reads its own checks', () => {
  const RUNS = [RUN, { ...RUN, name: 'lint', conclusion: 'failure' as const }];

  it('keeps the host notice while the host cannot read checks', () => {
    expect(
      view({
        hostKind: 'gitlab',
        hostUrl: 'https://gitlab.invalid/mr/57',
        pr: null,
        canReadChecks: false,
        portChecks: { read: 'ok', error: null, runs: RUNS },
      }),
    ).toEqual({ kind: 'host', host: 'gitlab', url: 'https://gitlab.invalid/mr/57' });
  });

  it('is loading until the port has answered', () => {
    expect(view({ hostKind: 'gitlab', pr: null, canReadChecks: true })).toEqual({
      kind: 'loading',
    });
  });

  it('names a read that failed before any checks came back', () => {
    expect(
      view({
        hostKind: 'gitlab',
        pr: null,
        canReadChecks: true,
        portReadFailure: { kind: 'failed', error: 'timeout' },
      }),
    ).toEqual({ kind: 'failed', error: 'timeout' });
    expect(
      view({
        hostKind: 'bitbucket',
        pr: null,
        canReadChecks: true,
        portReadFailure: { kind: 'denied', error: '403 Forbidden' },
      }),
    ).toEqual({ kind: 'denied', error: '403 Forbidden' });
  });

  it('shows the rows the port read, without a GitHub pull request', () => {
    expect(
      view({
        hostKind: 'bitbucket',
        pr: null,
        canReadChecks: true,
        portChecks: { read: 'ok', error: null, runs: RUNS },
      }),
    ).toEqual({ kind: 'ready', checks: RUNS });
  });

  it('names a denied or failed read the way GitHub does', () => {
    expect(
      view({
        hostKind: 'gitlab',
        pr: null,
        canReadChecks: true,
        portChecks: { read: 'denied', error: '403 Forbidden', runs: [] },
      }),
    ).toEqual({ kind: 'denied', error: '403 Forbidden' });
    expect(
      view({
        hostKind: 'gitlab',
        pr: null,
        canReadChecks: true,
        portChecks: { read: 'failed', error: 'timeout', runs: [] },
      }),
    ).toEqual({ kind: 'failed', error: 'timeout' });
  });

  it('falls back to the host notice when the port says it cannot', () => {
    expect(
      view({
        hostKind: 'bitbucket',
        hostUrl: 'https://bitbucket.invalid/pr/12',
        pr: null,
        canReadChecks: true,
        portChecks: { read: 'unsupported', error: null, runs: [] },
      }),
    ).toEqual({ kind: 'host', host: 'bitbucket', url: 'https://bitbucket.invalid/pr/12' });
  });
});
