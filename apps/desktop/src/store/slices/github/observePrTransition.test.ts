import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PullRequestState, PullRequestStateKind, SessionId } from '@goodboy/types';
import { observePrTransition } from './observePrTransition';
import type { GetFn } from './types';

const sessionId = 'session-1' as SessionId;

type PrParams = {
  readonly state: PullRequestStateKind;
  readonly number?: number;
};

const makePr = ({ state, number = 42 }: PrParams): PullRequestState => ({
  number,
  title: 'Persist the session trace',
  url: `https://github.com/acme/web/pull/${number}`,
  state,
  mergeable: true,
  checks: 'success',
  baseBranch: 'main',
  headBranch: 'ak/feat-session-events',
  isDraft: false,
  reviewDecision: null,
  body: '',
  updatedAt: '2026-08-21T10:00:00.000Z',
});

type RecordParams = {
  readonly kind: string;
};

const record = vi.fn(async (_params: RecordParams) => undefined);
const get = (() => ({ recordSessionEventOnce: record })) as unknown as GetFn;

describe('observePrTransition', () => {
  beforeEach(() => {
    record.mockClear();
  });

  it('records an approval observed between two polls', async () => {
    await observePrTransition({
      get,
      sessionId,
      previous: makePr({ state: 'open' }),
      next: makePr({ state: 'approved' }),
    });

    expect(record).toHaveBeenCalledWith({
      sessionId,
      kind: 'pr_approved',
      payload: {
        number: 42,
        title: 'Persist the session trace',
        url: 'https://github.com/acme/web/pull/42',
      },
    });
  });

  it('records a merge observed between two polls', async () => {
    await observePrTransition({
      get,
      sessionId,
      previous: makePr({ state: 'approved' }),
      next: makePr({ state: 'merged' }),
    });

    expect(record.mock.calls[0]?.[0]).toMatchObject({ kind: 'pr_merged' });
  });

  it('stays quiet when the state did not move', async () => {
    await observePrTransition({
      get,
      sessionId,
      previous: makePr({ state: 'open' }),
      next: makePr({ state: 'open' }),
    });

    expect(record).not.toHaveBeenCalled();
  });

  it('stays quiet on a transition with no event of its own', async () => {
    await observePrTransition({
      get,
      sessionId,
      previous: makePr({ state: 'draft' }),
      next: makePr({ state: 'open' }),
    });

    expect(record).not.toHaveBeenCalled();
  });

  it('stays quiet when the poll returns a different pull request', async () => {
    await observePrTransition({
      get,
      sessionId,
      previous: makePr({ state: 'open', number: 41 }),
      next: makePr({ state: 'merged', number: 42 }),
    });

    expect(record).not.toHaveBeenCalled();
  });

  it('stays quiet the first time a pull request is seen', async () => {
    await observePrTransition({
      get,
      sessionId,
      previous: null,
      next: makePr({ state: 'merged' }),
    });

    expect(record).not.toHaveBeenCalled();
  });
});
