// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { branchFactsOf, type BranchStatusFacts } from './branches/branchFactsOf';
import { branchEntriesOf } from './branches/branchStoryOf';
import { aMountRow, aRequest } from './branches/testing/aMountRow';
import { overviewHasContentOf } from './overviewHasContentOf';

const NOW = Date.UTC(2026, 10, 6, 9, 0, 0);

const NEEDS_YOU_EMPTY = { id: 'needs-you', title: 'Needs you', count: 0 } as const;

type EntriesParams = {
  readonly isRequested?: boolean;
  readonly liveCount?: number;
  readonly status?: BranchStatusFacts;
};

const entriesOf = ({ isRequested = false, liveCount = 0, status }: EntriesParams = {}) => {
  const row = aMountRow({
    key: 'ledger',
    projectName: 'ledger-core',
    branch: 'fix/ledger-reconciliation',
    request: isRequested ? aRequest({ provider: 'github', number: 12 }) : null,
  });
  const facts = branchFactsOf({
    rows: [row],
    fetchedAtByMountId: new Map([[row.mountId, new Date(NOW).toISOString()]]),
    behindByMountId: new Map(),
    liveCountByMountId: new Map([[row.mountId, liveCount]]),
    statusByMountId: status === undefined ? new Map() : new Map([[row.mountId, status]]),
    now: NOW,
  });
  const entries = branchEntriesOf({ facts, detailByMountId: new Map() });
  return [...entries.live, ...entries.finished];
};

const AHEAD: BranchStatusFacts = {
  ahead: 2,
  push: { kind: 'ahead', ahead: 2 },
  changedFiles: 3,
  isRebasing: false,
};

const FRESH: BranchStatusFacts = {
  ahead: 0,
  push: { kind: 'in-sync' },
  changedFiles: 0,
  isRebasing: false,
};

const NO_EXTRA = { hasFolders: false, hasUnassignedNotes: false, hasClosedWorktree: false };

describe('overviewHasContentOf', () => {
  it('is empty for a mount just created: no commits, no request, no run', () => {
    expect(
      overviewHasContentOf({
        shown: [NEEDS_YOU_EMPTY],
        entries: entriesOf({ status: FRESH }),
        ...NO_EXTRA,
      }),
    ).toBe(false);
  });

  it('is empty for a mount whose status is not read yet', () => {
    expect(
      overviewHasContentOf({ shown: [NEEDS_YOU_EMPTY], entries: entriesOf(), ...NO_EXTRA }),
    ).toBe(false);
  });

  it('holds content once the mount has commits', () => {
    expect(
      overviewHasContentOf({
        shown: [NEEDS_YOU_EMPTY],
        entries: entriesOf({ status: AHEAD }),
        ...NO_EXTRA,
      }),
    ).toBe(true);
  });

  it('holds content once the mount has a request', () => {
    expect(
      overviewHasContentOf({
        shown: [NEEDS_YOU_EMPTY],
        entries: entriesOf({ isRequested: true }),
        ...NO_EXTRA,
      }),
    ).toBe(true);
  });

  it('holds content while a run works on the mount', () => {
    expect(
      overviewHasContentOf({
        shown: [NEEDS_YOU_EMPTY],
        entries: entriesOf({ liveCount: 1 }),
        ...NO_EXTRA,
      }),
    ).toBe(true);
  });

  it('holds content when a card is drawn', () => {
    expect(
      overviewHasContentOf({
        shown: [{ id: 'running', title: 'Running', count: 1 }],
        entries: [],
        ...NO_EXTRA,
      }),
    ).toBe(true);
  });

  it.each([
    ['a folder card', { hasFolders: true }],
    ['an unassigned note', { hasUnassignedNotes: true }],
    ['a closed worktree notice', { hasClosedWorktree: true }],
  ])('holds content while %s is drawn, so the start form stays away', (_name, extra) => {
    expect(
      overviewHasContentOf({
        shown: [NEEDS_YOU_EMPTY],
        entries: entriesOf({ status: FRESH }),
        ...NO_EXTRA,
        ...extra,
      }),
    ).toBe(true);
  });
});
