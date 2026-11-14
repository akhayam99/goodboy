import { describe, expect, it } from 'vitest';
import {
  pullRequestAskTextOf,
  pullRequestOfResult,
  pullRequestTextVersionOf,
  type ResultPullRequest,
} from './pullRequestAsk';

const HELD: ResultPullRequest = {
  state: 'awaiting_confirm',
  mountId: 'mount-ledger-core',
  grantId: 'grant-pr-attempt-1',
  textVersion: 'attempt-1:0011223344556677',
  title: 'Add the ledger export',
  body: '  Exports the ledger as CSV.\n\n',
  number: null,
  url: null,
  message: null,
  startedAt: null,
};

describe('the pull request text a Lead holds for you', () => {
  it('versions the text by its attempt and its exact bytes', () => {
    const first = pullRequestTextVersionOf({ attemptId: 'attempt-1', title: 'A', body: 'B' });
    expect(pullRequestTextVersionOf({ attemptId: 'attempt-1', title: 'A', body: 'B' })).toBe(first);
    expect(pullRequestTextVersionOf({ attemptId: 'attempt-1', title: 'A', body: 'B ' })).not.toBe(
      first,
    );
    expect(pullRequestTextVersionOf({ attemptId: 'attempt-2', title: 'A', body: 'B' })).not.toBe(
      first,
    );
  });

  it('reads the held record back without touching the text', () => {
    const result = { verified: { pullRequest: JSON.parse(JSON.stringify(HELD)) } };
    expect(pullRequestOfResult({ result })).toEqual(HELD);
    expect(pullRequestOfResult({ result: { verified: {} } })).toBeNull();
    expect(
      pullRequestOfResult({ result: { verified: { pullRequest: { ...HELD, state: 'odd' } } } }),
    ).toBeNull();
  });

  it('names each state for the digest', () => {
    expect(pullRequestAskTextOf({ pullRequest: HELD })).toBe(
      'The pull request waits for you to open it: Add the ledger export',
    );
    expect(
      pullRequestAskTextOf({
        pullRequest: {
          ...HELD,
          state: 'opened',
          number: 421,
          url: 'https://github.com/harborline/ledger-core/pull/421',
        },
      }),
    ).toBe('Pull request #421 is open: https://github.com/harborline/ledger-core/pull/421');
    expect(pullRequestAskTextOf({ pullRequest: { ...HELD, state: 'declined' } })).toBe(
      'Not opened yet, the text is kept: Add the ledger export',
    );
  });
});
