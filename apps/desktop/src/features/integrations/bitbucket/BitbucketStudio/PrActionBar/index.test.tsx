import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { BitbucketParticipant, BitbucketPullRequest } from '../../client';
import { PrActionBar, type BitbucketPrActionBusy } from './index';

const ME: BitbucketParticipant = {
  user: {
    uuid: '{u1}',
    accountId: 'acc-1',
    nickname: 'kim',
    displayName: 'Kim Lee',
    avatarUrl: null,
  },
  role: 'REVIEWER',
  approved: true,
  state: 'approved',
};

const buildPr = (overrides: Partial<BitbucketPullRequest>): BitbucketPullRequest => ({
  id: 42,
  title: 'Raise the fuel constant',
  description: '',
  state: 'OPEN',
  createdOn: '2026-08-01T09:00:00Z',
  updatedOn: '2026-08-01T11:00:00Z',
  sourceBranch: 'ak/feat-fuel',
  sourceCommit: null,
  destinationBranch: 'main',
  destinationCommit: null,
  author: null,
  reviewers: [],
  participants: [],
  closeSourceBranch: false,
  mergeCommit: null,
  commentCount: 0,
  taskCount: 0,
  webUrl: null,
  ...overrides,
});

type RenderParams = {
  readonly pullRequest?: BitbucketPullRequest;
  readonly accountId?: string | null;
  readonly displayName?: string | null;
  readonly busy?: BitbucketPrActionBusy;
  readonly canAct?: boolean;
};

const handlers = {
  onApprove: vi.fn(),
  onUnapprove: vi.fn(),
  onRequestChanges: vi.fn(),
  onWithdrawChanges: vi.fn(),
  onMerge: vi.fn(async () => undefined),
  onDecline: vi.fn(async () => undefined),
};

const renderBar = ({
  pullRequest = buildPr({}),
  accountId = 'acc-1',
  displayName = 'Kim Lee',
  busy = null,
  canAct = true,
}: RenderParams) => {
  Object.values(handlers).forEach((handler) => handler.mockClear());
  return render(
    <PrActionBar
      pullRequest={pullRequest}
      accountId={accountId}
      displayName={displayName}
      busy={busy}
      canAct={canAct}
      {...handlers}
    />,
  );
};

describe('PrActionBar', () => {
  afterEach(cleanup);

  it('sends my approval, and offers to take it back once it is recorded', () => {
    renderBar({});
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect(handlers.onApprove).toHaveBeenCalledTimes(1);

    cleanup();
    renderBar({ pullRequest: buildPr({ participants: [ME] }) });
    expect(screen.getByText('You approved this pull request. 1 approval so far')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Revoke approval' }));
    expect(handlers.onUnapprove).toHaveBeenCalledTimes(1);
  });

  it('swaps request changes for a withdrawal once I asked for them', () => {
    renderBar({
      pullRequest: buildPr({
        participants: [{ ...ME, approved: false, state: 'changes_requested' }],
      }),
    });
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw request' }));
    expect(handlers.onWithdrawChanges).toHaveBeenCalledTimes(1);
    expect(handlers.onRequestChanges).not.toHaveBeenCalled();
  });

  it('keeps the vote buttons on screen and says why they are off when the account is unknown', () => {
    renderBar({ accountId: null, displayName: null, pullRequest: buildPr({ participants: [] }) });
    const approve = screen.getByRole('button', { name: 'Approve' });
    expect(approve.getAttribute('aria-disabled')).toBe('true');
    expect(approve.getAttribute('title')).toContain('Reconnect Bitbucket');
    fireEvent.click(approve);
    expect(handlers.onApprove).not.toHaveBeenCalled();
  });

  it('says which write is holding the bar while one is in flight', () => {
    renderBar({ busy: 'merge' });
    const merge = screen.getByRole('button', { name: 'Merge' });
    expect(merge.getAttribute('title')).toContain('still running');
    fireEvent.click(merge);
    expect(screen.queryByRole('group', { name: 'Merge this pull request?' })).toBeNull();
  });

  it('says why nothing can be written before the pull request resolves', () => {
    renderBar({ canAct: false });
    const decline = screen.getByRole('button', { name: 'Decline' });
    expect(decline.getAttribute('aria-disabled')).toBe('true');
    expect(decline.getAttribute('title')).toContain('still resolving');
  });

  it.each([
    ['Merge', 'Merge this pull request?', 'Confirm merge', 'onMerge'],
    ['Decline', 'Decline this pull request?', 'Confirm decline', 'onDecline'],
  ] as const)('asks before it %ss', async (label, question, confirmLabel, handlerKey) => {
    renderBar({});
    fireEvent.click(screen.getByRole('button', { name: label }));
    expect(handlers[handlerKey]).not.toHaveBeenCalled();
    expect(screen.getByRole('group', { name: question })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: confirmLabel }));
    await waitFor(() => expect(handlers[handlerKey]).toHaveBeenCalledTimes(1));
  });

  it.each([
    ['Merge', 'Cancel', 'onMerge'],
    ['Decline', 'Cancel', 'onDecline'],
  ] as const)('backing out of the %s confirmation writes nothing', (label, cancelLabel, key) => {
    renderBar({});
    fireEvent.click(screen.getByRole('button', { name: label }));
    fireEvent.click(screen.getByRole('button', { name: cancelLabel }));

    expect(handlers[key]).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: label })).toBeTruthy();
  });

  it.each([
    ['MERGED', /This pull request is merged/],
    ['DECLINED', /This pull request was declined/],
    ['SUPERSEDED', /Another pull request superseded this one/],
  ] as const)('drops the moves and says so in words once the state is %s', (state, sentence) => {
    renderBar({ pullRequest: buildPr({ state }) });

    expect(screen.queryByRole('button', { name: 'Merge' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Decline' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
    expect(screen.getByText(sentence)).toBeTruthy();
  });
});
