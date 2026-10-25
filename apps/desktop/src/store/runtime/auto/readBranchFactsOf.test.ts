import { describe, expect, it, vi } from 'vitest';
import type { BranchFactsRequest } from '@goodboy/core';
import { brandId, type SessionId } from '@goodboy/types';
import type { ReadBranchFactsParams } from './ports';
import { readBranchFactsOf, type BranchFactsReaders } from './readBranchFactsOf';

const PARAMS: ReadBranchFactsParams = {
  sessionId: brandId<SessionId>({ value: 'session-harborline' }),
  mountId: 'mount-ledger-core',
  worktreePath: '/work/harborline/ledger-core',
  branch: 'ak/ledger-export',
};

const HOSTS = [
  { host: 'github', url: 'https://github.com/harborline/ledger-core/pull/421' },
  { host: 'gitlab', url: 'https://gitlab.example.com/harborline/ledger-core/-/merge_requests/421' },
  { host: 'bitbucket', url: 'https://bitbucket.org/harborline/ledger-core/pull-requests/421' },
] as const;

const requestOf = ({ host, url }: (typeof HOSTS)[number]): BranchFactsRequest => ({
  host,
  number: 421,
  title: 'Export the ledger',
  url,
  state: 'open',
  isDraft: false,
  baseBranch: 'main',
  headBranch: 'ak/ledger-export',
});

const readersOf = (entry: (typeof HOSTS)[number]): BranchFactsReaders => ({
  commits: vi.fn(async () => [{ sha: 'abc123def', subject: 'feat: export the ledger' }]),
  request: vi.fn(async () => ({
    request: requestOf(entry),
    checks: { kind: 'ok' as const, value: [{ name: 'ci', conclusion: 'success' }] },
  })),
  threads: vi.fn(async () => [
    { author: 'northwind-dev', path: 'src/export.ts', body: 'rename it', isResolved: false },
  ]),
});

describe.each(HOSTS)('reading the facts of a branch on $host', (entry) => {
  it('gives the commits, the request, the threads and the checks', async () => {
    const readers = readersOf(entry);
    const parts = await readBranchFactsOf({ readers, params: PARAMS });
    expect(parts.commits).toMatchObject({ kind: 'ok' });
    expect(parts.request).toEqual({ kind: 'ok', value: requestOf(entry) });
    expect(parts.threads).toMatchObject({ kind: 'ok', value: [{ author: 'northwind-dev' }] });
    expect(parts.checks).toEqual({
      kind: 'ok',
      value: [{ name: 'ci', conclusion: 'success' }],
    });
    expect(readers.threads).toHaveBeenCalledWith({ params: PARAMS, request: requestOf(entry) });
  });

  it('marks the request and what hangs on it when the host fails, and keeps the commits', async () => {
    const readers: BranchFactsReaders = {
      ...readersOf(entry),
      request: vi.fn(async () => {
        throw new Error('the host answered 502');
      }),
    };
    const parts = await readBranchFactsOf({ readers, params: PARAMS });
    expect(parts.commits.kind).toBe('ok');
    expect(parts.request).toEqual({ kind: 'unavailable', reason: 'the host answered 502' });
    expect(parts.threads).toEqual({ kind: 'unavailable', reason: 'the host answered 502' });
    expect(parts.checks).toEqual({ kind: 'unavailable', reason: 'the host answered 502' });
    expect(readers.threads).not.toHaveBeenCalled();
  });

  it('marks only the threads when the threads fail', async () => {
    const readers: BranchFactsReaders = {
      ...readersOf(entry),
      threads: vi.fn(async () => {
        throw new Error('rate limited');
      }),
    };
    const parts = await readBranchFactsOf({ readers, params: PARAMS });
    expect(parts.threads).toEqual({ kind: 'unavailable', reason: 'rate limited' });
    expect(parts.checks.kind).toBe('ok');
    expect(parts.request.kind).toBe('ok');
  });

  it('passes a checks part the host could not read through as it is', async () => {
    const readers: BranchFactsReaders = {
      ...readersOf(entry),
      request: vi.fn(async () => ({
        request: requestOf(entry),
        checks: { kind: 'unavailable' as const, reason: 'the host answered denied' },
      })),
    };
    const parts = await readBranchFactsOf({ readers, params: PARAMS });
    expect(parts.checks).toEqual({ kind: 'unavailable', reason: 'the host answered denied' });
  });
});

describe('a branch with no request', () => {
  it('says none is open and does not read threads', async () => {
    const readers: BranchFactsReaders = {
      ...readersOf(HOSTS[0]),
      request: vi.fn(async () => null),
    };
    const parts = await readBranchFactsOf({ readers, params: PARAMS });
    expect(parts.request).toEqual({ kind: 'ok', value: null });
    expect(parts.commits.kind).toBe('ok');
    expect(parts.threads.kind).toBe('unavailable');
    expect(readers.threads).not.toHaveBeenCalled();
  });

  it('marks the commits when the base is unknown', async () => {
    const readers: BranchFactsReaders = {
      ...readersOf(HOSTS[0]),
      commits: vi.fn(async () => {
        throw new Error('this mount has no base branch');
      }),
    };
    const parts = await readBranchFactsOf({ readers, params: PARAMS });
    expect(parts.commits).toEqual({
      kind: 'unavailable',
      reason: 'this mount has no base branch',
    });
    expect(parts.request.kind).toBe('ok');
  });
});
