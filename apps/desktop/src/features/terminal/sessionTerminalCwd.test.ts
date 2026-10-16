import { describe, expect, it } from 'vitest';
import { sessionTerminalCwd } from './sessionTerminalCwd';

const PAYMENTS = '/work/harborline/payments-api-export';
const LEDGER = '/work/harborline/ledger-core-payout';

describe('sessionTerminalCwd', () => {
  it('has no worktree to open on when the session has none', () => {
    expect(sessionTerminalCwd({ mountPaths: [], remembered: PAYMENTS, activePath: null })).toBe(
      null,
    );
  });

  it('opens on the only worktree, whatever was remembered', () => {
    expect(
      sessionTerminalCwd({ mountPaths: [LEDGER], remembered: PAYMENTS, activePath: PAYMENTS }),
    ).toBe(LEDGER);
  });

  it('opens on the remembered worktree when the session has several', () => {
    expect(
      sessionTerminalCwd({
        mountPaths: [LEDGER, PAYMENTS],
        remembered: PAYMENTS,
        activePath: LEDGER,
      }),
    ).toBe(PAYMENTS);
  });

  it('falls back to the active worktree the first time, or when the remembered one left', () => {
    expect(
      sessionTerminalCwd({
        mountPaths: [LEDGER, PAYMENTS],
        remembered: null,
        activePath: PAYMENTS,
      }),
    ).toBe(PAYMENTS);
    expect(
      sessionTerminalCwd({
        mountPaths: [LEDGER, PAYMENTS],
        remembered: '/work/harborline/gone',
        activePath: null,
      }),
    ).toBe(LEDGER);
  });
});
