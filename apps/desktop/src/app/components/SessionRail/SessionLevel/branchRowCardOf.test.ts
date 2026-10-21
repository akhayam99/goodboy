import { describe, expect, it } from 'vitest';
import type { BranchRowFacts } from '../../../../features/branch/branchRowFactsOf';
import { branchRowCardOf } from './branchRowCardOf';
import type { BranchRowChip } from './branchRowChipOf';

const FACTS: BranchRowFacts = {
  title: 'Retry the ledger export',
  isBranchTitle: false,
  branch: 'hl/export-batch',
  state: 'open',
  stateWord: 'Open',
  number: '#318',
  host: 'github',
  hostName: 'GitHub',
  isFinished: false,
  rank: 0,
  checks: null,
  signal: null,
  label: 'Retry the ledger export, #318, Open, branch hl/export-batch',
};

const FAILED: BranchRowChip = {
  kind: 'failed',
  tone: 'danger',
  text: "Couldn't rebase",
  reason: 'origin cannot be reached',
  isBreathing: false,
  icon: null,
};

describe('branchRowCardOf', () => {
  it('titles the card with the branch, the number beside it and the state', () => {
    const card = branchRowCardOf({ facts: FACTS, chip: null, reason: null });

    expect(card.title).toBe('hl/export-batch');
    expect(card.sub).toBe('#318');
    expect(card.state).toEqual({ tone: 'info', words: 'Open' });
    expect(card.facts).toEqual([]);
    expect(card.footnote).toBeUndefined();
  });

  it('gives the chip as a status row and its cause as the footnote', () => {
    const card = branchRowCardOf({ facts: FACTS, chip: FAILED, reason: null });

    expect(card.facts).toEqual([{ label: 'Status', value: "Couldn't rebase", tone: 'danger' }]);
    expect(card.footnote).toBe('origin cannot be reached');
  });

  it('keeps the row reason when there is no chip and drops number and state when absent', () => {
    const card = branchRowCardOf({
      facts: { ...FACTS, number: null, stateWord: null, state: 'none' },
      chip: null,
      reason: 'The worktree folder is gone',
    });

    expect(card.sub).toBeUndefined();
    expect(card.state).toBeUndefined();
    expect(card.footnote).toBe('The worktree folder is gone');
  });
});
