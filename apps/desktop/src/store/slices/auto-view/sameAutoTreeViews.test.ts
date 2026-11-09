import { describe, expect, it } from 'vitest';
import { aDelegation, aView } from '../../../features/auto/testing/autoViewFixtures';
import { sameAutoTreeViews } from './sameAutoTreeViews';

type ResultParams = {
  readonly publishState: string;
  readonly verdict?: string;
  readonly costUsd?: number;
};

const resultWith = ({ publishState, verdict = 'green', costUsd = 0.1 }: ResultParams) => ({
  declared: { summary: 'Squashed.' },
  verified: {
    changedFiles: [],
    checks: [{ name: 'typecheck', status: verdict === 'green' ? 'pass' : 'fail' }],
    checksRun: { verdict, reason: null, commit: 'abc1234' },
    publish: {
      mode: 'force',
      state: publishState,
      branch: 'harborline/fix-ledger',
      sha: 'abc1234',
      leaseSha: 'remote111',
      backupRef: 'refs/goodboy/backup/keep-1',
      message: null,
      isRetryable: false,
      isConfirmed: publishState !== 'awaiting_confirm',
      tries: publishState === 'awaiting_confirm' ? 0 : 1,
      reviewerReportId: null,
      isContentChanging: false,
    },
  },
  cost: { usd: costUsd, basis: 'reported' },
});

const viewWith = (params: ResultParams) => [
  aView({
    phase: 'waiting',
    delegations: [
      aDelegation({
        key: 'impl',
        role: 'implementer',
        state: 'settled',
        outcome: 'completed',
        settledAt: 1_000,
        result: resultWith(params),
      }),
    ],
  }),
];

describe('sameAutoTreeViews', () => {
  it('calls a saved push result a change, so the card redraws after Force push', () => {
    const waiting = viewWith({ publishState: 'awaiting_confirm' });
    const pushed = viewWith({ publishState: 'pushed' });

    expect(sameAutoTreeViews({ first: waiting, second: pushed })).toBe(false);
  });

  it('calls a new checks verdict a change, so Run checks again shows its answer', () => {
    const green = viewWith({ publishState: 'pushed' });
    const red = viewWith({ publishState: 'pushed', verdict: 'red' });

    expect(sameAutoTreeViews({ first: green, second: red })).toBe(false);
  });

  it('keeps the views the same when nothing the cards read changed', () => {
    const first = viewWith({ publishState: 'pushed', costUsd: 0.1 });
    const second = viewWith({ publishState: 'pushed', costUsd: 0.1 });

    expect(sameAutoTreeViews({ first, second })).toBe(true);
  });
});
