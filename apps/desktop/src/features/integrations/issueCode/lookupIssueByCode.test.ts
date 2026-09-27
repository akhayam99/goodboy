import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceId } from '@goodboy/types';

const h = vi.hoisted(() => ({
  linearFetchIssue: vi.fn(),
  jiraGetIssue: vi.fn(),
  ghIssueInRepo: vi.fn(),
  gitlabFetchIssue: vi.fn(),
  sentryResolveShortId: vi.fn(),
  sentryFetchIssue: vi.fn(),
}));

vi.mock('../linear/client', () => ({ linearFetchIssue: h.linearFetchIssue }));
vi.mock('../jira/client', () => ({ jiraGetIssue: h.jiraGetIssue }));
vi.mock('../../github/github', () => ({ ghIssueInRepo: h.ghIssueInRepo }));
vi.mock('../gitlab/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../gitlab/client')>()),
  gitlabFetchIssue: h.gitlabFetchIssue,
}));
vi.mock('../sentry/client', () => ({
  sentryResolveShortId: h.sentryResolveShortId,
  sentryFetchIssue: h.sentryFetchIssue,
}));

import { classifyLookupError } from './classifyLookupError';
import { lookupIssueByCode } from './lookupIssueByCode';

const WORKSPACE = 'ws-harborline' as WorkspaceId;
const deps = { workspaceId: WORKSPACE, gitlabHost: null, jiraConfig: null };

const githubIssue = (number: number) => ({
  number,
  title: 'Checkout total rounds down',
  body: '',
  url: `https://github.com/acme/storefront-web/issues/${number}`,
  state: 'OPEN',
  labels: [],
  updatedAt: '2026-09-20T10:00:00Z',
  author: 'someone',
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('classifyLookupError', () => {
  it.each([
    [{ kind: 'not_found', message: 'not found: gone' }, 'not-found'],
    [{ kind: 'auth', message: 'authentication failed' }, 'unauthorized'],
    [{ kind: 'http', message: 'http error: status 404 Not Found: {}' }, 'not-found'],
    [{ kind: 'http', message: 'http error: status 401 Unauthorized' }, 'unauthorized'],
    [{ kind: 'http', message: 'http error 403: {}' }, 'forbidden'],
    [{ kind: 'http', message: 'http error: status 429 Too Many Requests' }, 'rate-limited'],
    [new Error('gh run [issue view] failed: GraphQL: Could not resolve to an issue'), 'not-found'],
    [new Error('connection reset'), 'unreachable'],
  ])('maps %j to %s', (error, failure) => {
    expect(classifyLookupError(error)).toBe(failure);
  });
});

describe('lookupIssueByCode', () => {
  it('asks every repo for #N and names each hit by its repo', async () => {
    h.ghIssueInRepo
      .mockResolvedValueOnce(githubIssue(482))
      .mockRejectedValueOnce(new Error('Could not resolve to an issue'));

    const result = await lookupIssueByCode({
      ...deps,
      targets: [
        { provider: 'github', repo: 'acme/storefront-web', number: 482 },
        { provider: 'github', repo: 'acme/ledger-core', number: 482 },
      ],
    });

    expect(result.hits).toHaveLength(1);
    expect(result.hits[0]?.record.identifier).toBe('storefront-web #482');
    expect(result.hits[0]?.candidate.identifier).toBe('#482');
    expect(result.misses).toEqual([
      {
        target: { provider: 'github', repo: 'acme/ledger-core', number: 482 },
        failure: 'not-found',
      },
    ]);
  });

  it('resolves a Sentry short id across the organization', async () => {
    h.sentryResolveShortId.mockResolvedValueOnce({
      id: '91',
      shortId: 'NOTIFY-3F',
      title: 'KeyError: amount',
      culprit: null,
      level: 'error',
      status: 'unresolved',
      count: null,
      userCount: null,
      firstSeen: null,
      lastSeen: null,
      permalink: 'https://acme.sentry.io/issues/91/',
      metadata: null,
    });

    const result = await lookupIssueByCode({
      ...deps,
      targets: [{ provider: 'sentry', shortId: 'NOTIFY-3F' }],
    });

    expect(h.sentryResolveShortId).toHaveBeenCalledWith({
      workspaceId: WORKSPACE,
      shortId: 'NOTIFY-3F',
    });
    expect(result.hits[0]?.record.key).toBe('sentry:error:91');
  });

  it('reports a rejected key per tracker instead of throwing', async () => {
    h.linearFetchIssue.mockRejectedValueOnce({ kind: 'http', message: 'http error: status 401' });

    const result = await lookupIssueByCode({
      ...deps,
      targets: [{ provider: 'linear', identifier: 'CAS-231' }],
    });

    expect(result).toEqual({
      hits: [],
      misses: [{ target: { provider: 'linear', identifier: 'CAS-231' }, failure: 'unauthorized' }],
    });
  });
});
