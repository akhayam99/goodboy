import { describe, expect, it } from 'vitest';
import type { PrDetail, PullRequestState } from '@goodboy/types';
import { checksUnreadReasonOf } from './checksUnreadReasonOf';

const PR: PullRequestState = {
  number: 318,
  title: 'Stop retried webhooks posting a second credit',
  url: 'https://github.com/harborline/payments-api/pull/318',
  state: 'open',
  mergeable: true,
  checks: 'failure',
  baseBranch: 'main',
  headBranch: 'hl/fix-duplicate-credit',
  isDraft: false,
  reviewDecision: null,
  body: '',
  updatedAt: '2026-11-07T10:00:00Z',
};

type DetailParams = {
  readonly prNumber: number;
  readonly checksRead: PrDetail['checksRead'];
};

const detailOf = ({ prNumber, checksRead }: DetailParams): PrDetail => ({
  prNumber,
  comments: [],
  reviews: [],
  reviewRequests: [],
  checks: [],
  checksRead,
});

describe('checksUnreadReasonOf', () => {
  it('says nothing without a pull request or when the checks were read', () => {
    expect(checksUnreadReasonOf({ pr: null, detail: null })).toBeNull();
    expect(
      checksUnreadReasonOf({ pr: PR, detail: detailOf({ prNumber: 318, checksRead: 'ok' }) }),
    ).toBeNull();
  });

  it('names the token when the host denies the checks or marks them unknown', () => {
    const denied = detailOf({ prNumber: 318, checksRead: 'denied' });
    expect(checksUnreadReasonOf({ pr: PR, detail: denied })).toBe(
      "Checks unknown: this token can't read them",
    );
    expect(checksUnreadReasonOf({ pr: { ...PR, checksUnknown: true }, detail: null })).toBe(
      "Checks unknown: this token can't read them",
    );
  });

  it('says the read failed, and ignores a detail of another pull request', () => {
    expect(
      checksUnreadReasonOf({ pr: PR, detail: detailOf({ prNumber: 318, checksRead: 'failed' }) }),
    ).toBe("Checks unknown: couldn't read them");
    expect(
      checksUnreadReasonOf({ pr: PR, detail: detailOf({ prNumber: 77, checksRead: 'failed' }) }),
    ).toBeNull();
  });
});
