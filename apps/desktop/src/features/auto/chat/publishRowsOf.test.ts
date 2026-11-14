import { describe, expect, it } from 'vitest';
import { aDelegation } from '../testing/autoViewFixtures';
import { publishRowsOf } from './publishRowsOf';

type SavedParams = {
  readonly state: string;
  readonly isConfirmed: boolean;
  readonly tries: number;
  readonly mode?: string;
  readonly isRetryable?: boolean;
  readonly startedAt?: number | null;
};

const saved = ({
  state,
  isConfirmed,
  tries,
  mode = 'force',
  isRetryable = true,
  startedAt = null,
}: SavedParams) =>
  aDelegation({
    key: 'a',
    role: 'implementer',
    state: 'settled',
    outcome: 'completed',
    settledAt: 1_000,
    result: {
      verified: {
        publish: {
          mode,
          state,
          branch: 'harborline/a',
          sha: 'abc1234',
          leaseSha: null,
          backupRef: null,
          message: state === 'failed' ? 'A backup could not be kept.' : null,
          isRetryable,
          isConfirmed,
          tries,
          startedAt,
          reviewerReportId: null,
          isContentChanging: false,
        },
      },
    },
  });

describe('which push rows the card keeps', () => {
  it('keeps the notice when a retry is held again after the user acted', () => {
    const rows = publishRowsOf({
      delegations: [saved({ state: 'failed', isConfirmed: false, tries: 1 })],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.line.state).toBe('failed');
    expect(rows[0]?.line.canRetry).toBe(true);
  });

  it('keeps the notice when a push failed after the confirm', () => {
    const rows = publishRowsOf({
      delegations: [saved({ state: 'failed', isConfirmed: true, tries: 1 })],
    });

    expect(rows).toHaveLength(1);
  });

  it('shows no row for a first plan the gate held before anyone was asked', () => {
    const rows = publishRowsOf({
      delegations: [saved({ state: 'failed', isConfirmed: false, tries: 0 })],
    });

    expect(rows).toEqual([]);
  });

  it('keeps the failure and Retry of a first push that started and was never saved', () => {
    const rows = publishRowsOf({
      delegations: [saved({ state: 'failed', isConfirmed: false, tries: 0, startedAt: 5_000 })],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.line.state).toBe('failed');
    expect(rows[0]?.line.canRetry).toBe(true);
  });

  it('shows no row for a plain push', () => {
    const rows = publishRowsOf({
      delegations: [saved({ state: 'failed', isConfirmed: false, tries: 1, mode: 'push' })],
    });

    expect(rows).toEqual([]);
  });

  it('keeps a held plain push and the one declined, as plain rows', () => {
    const held = publishRowsOf({
      delegations: [
        saved({ state: 'awaiting_confirm', isConfirmed: false, tries: 0, mode: 'push' }),
      ],
    });
    const declined = publishRowsOf({
      delegations: [saved({ state: 'declined', isConfirmed: false, tries: 0, mode: 'push' })],
    });

    expect(held.map((row) => row.isForce)).toEqual([false]);
    expect(declined.map((row) => row.line.state)).toEqual(['declined']);
  });

  it('keeps a row waiting for the answer', () => {
    const rows = publishRowsOf({
      delegations: [saved({ state: 'awaiting_confirm', isConfirmed: false, tries: 0 })],
    });

    expect(rows).toHaveLength(1);
  });
});
