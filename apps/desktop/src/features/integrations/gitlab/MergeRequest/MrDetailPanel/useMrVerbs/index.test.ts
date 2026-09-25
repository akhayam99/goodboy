import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { GitlabMergeRequest, GitlabMrApprovalState } from '../../../client';
import { useMrVerbs, type MrVerbBusy } from './index';

const makeMr = (overrides: Partial<GitlabMergeRequest> = {}): GitlabMergeRequest => ({
  id: 1,
  iid: 4,
  projectId: 9,
  title: 'Batch settlement writes in ledger-core',
  description: null,
  state: 'opened',
  webUrl: 'https://gitlab.com/harborline/ledger-core/-/merge_requests/4',
  sourceBranch: 'batch-writes',
  targetBranch: 'main',
  draft: false,
  hasConflicts: false,
  mergeStatus: 'can_be_merged',
  updatedAt: '2026-08-01T00:00:00Z',
  ...overrides,
});

const makeApproval = (overrides: Partial<GitlabMrApprovalState> = {}): GitlabMrApprovalState => ({
  approvalsRequired: 1,
  approvalsLeft: 1,
  userHasApproved: false,
  userCanApprove: true,
  approvedBy: [],
  ...overrides,
});

type VerbsParams = {
  readonly mr?: GitlabMergeRequest;
  readonly approval?: GitlabMrApprovalState | null;
  readonly isSupported?: boolean;
  readonly approvalError?: string | null;
  readonly busy?: MrVerbBusy;
  readonly canAct?: boolean;
};

const verbsFor = ({
  mr = makeMr(),
  approval = makeApproval(),
  isSupported = true,
  approvalError = null,
  busy = null,
  canAct = true,
}: VerbsParams) =>
  renderHook(() =>
    useMrVerbs({
      mr,
      busy,
      approval,
      isApprovalBusy: false,
      isSupported,
      approvalError,
      canAct,
      canMerge: true,
      onMerge: vi.fn(async () => undefined),
      onApprove: vi.fn(),
      onUnapprove: vi.fn(),
      onToggleDraft: vi.fn(),
      onClose: vi.fn(async () => undefined),
      onReopen: vi.fn(),
    }),
  ).result.current;

describe('useMrVerbs', () => {
  it.each([
    ['opened', ['approve', 'merge'], ['draft'], ['close']],
    ['closed', ['reopen'], [], []],
    ['merged', [], [], []],
  ] as const)(
    'keeps the contract on a %s merge request',
    (state, secondary, overflow, destructive) => {
      const verbs = verbsFor({ mr: makeMr({ state }) });

      expect(verbs.secondary.map((verb) => verb.key)).toEqual(secondary);
      expect(verbs.secondary.length).toBeLessThanOrEqual(2);
      expect(verbs.overflow.map((verb) => verb.key)).toEqual(overflow);
      expect(verbs.destructive.map((verb) => verb.key)).toEqual(destructive);
      expect(verbs.destructive.every((verb) => verb.confirm != null)).toBe(true);
    },
  );

  it('asks before it merges', () => {
    const merge = verbsFor({}).secondary.find((verb) => verb.key === 'merge');

    expect(merge?.confirm?.title).toBe('Merge !4?');
  });

  it('drops the vote when the GitLab instance has no approvals endpoint', () => {
    const verbs = verbsFor({ approval: null, isSupported: false });

    expect(verbs.secondary.map((verb) => verb.key)).toEqual(['merge']);
  });

  it('keeps the vote with a reason on a transient approval fetch error', () => {
    const approve = verbsFor({ approval: null, approvalError: 'Network request failed' })
      .secondary[0];

    expect(approve?.blockedReason).toBe('Network request failed');
  });

  it('says why the vote is off when the user cannot approve their own merge request', () => {
    const approve = verbsFor({ approval: makeApproval({ userCanApprove: false }) }).secondary[0];

    expect(approve?.blockedReason).toBe(
      'You do not have permission to approve this merge request.',
    );
  });

  it('offers Revoke approval once the user approved', () => {
    const approve = verbsFor({ approval: makeApproval({ userHasApproved: true }) }).secondary[0];

    expect(approve?.label).toBe('Revoke approval');
    expect(approve?.blockedReason).toBeNull();
  });

  it.each([
    [{ hasConflicts: true }, /conflicts/],
    [{ mergeStatus: 'cannot_be_merged' }, /cannot be merged/],
  ] as const)('keeps Merge visible but blocked with a reason for %o', (overrides, reason) => {
    const merge = verbsFor({ mr: makeMr(overrides) }).secondary.find(
      (verb) => verb.key === 'merge',
    );

    expect(merge?.blockedReason).toMatch(reason);
  });

  it('labels the draft toggle by the current draft state', () => {
    expect(verbsFor({ mr: makeMr({ draft: true }) }).overflow[0]?.label).toBe('Mark ready');
    expect(verbsFor({}).overflow[0]?.label).toBe('Convert to draft');
  });
});
