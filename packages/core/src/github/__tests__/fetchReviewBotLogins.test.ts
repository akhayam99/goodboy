import { describe, expect, it, vi } from 'vitest';
import type { GhRunner } from '../gh';
import { fetchReviewBotLogins } from '../fetchReviewBotLogins';

const PAGE_SIZE = 100;

type AuthorNode = {
  readonly author: { readonly __typename: string; readonly login: string };
};

const REVIEWS: ReadonlyArray<AuthorNode> = Array.from({ length: PAGE_SIZE + 1 }, (_, index) => ({
  author:
    index === 0
      ? { __typename: 'Bot', login: 'acme-review' }
      : { __typename: 'User', login: `reviewer-${index}` },
}));

const pagedRunner = (): GhRunner => ({
  run: vi.fn(async (args: ReadonlyArray<string>) => {
    const query = args.find((arg) => arg.startsWith('query=')) ?? '';
    const nodes = query.includes('reviews(first:100)')
      ? REVIEWS.slice(0, PAGE_SIZE)
      : REVIEWS.slice(-PAGE_SIZE);
    return {
      stdout: JSON.stringify({ data: { repository: { pullRequest: { reviews: { nodes } } } } }),
      stderr: '',
      exitCode: 0,
    };
  }),
});

describe('fetchReviewBotLogins', () => {
  it('reads the same first page of reviews as the review list when there are 101', async () => {
    const logins = await fetchReviewBotLogins({
      runner: pagedRunner(),
      repo: 'northwind/ledger-core',
      prNumber: 7,
      opts: {},
    });

    expect(logins).toEqual(new Set(['acme-review']));
  });
});
