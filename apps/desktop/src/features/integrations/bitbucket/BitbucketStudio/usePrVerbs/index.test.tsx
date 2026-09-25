import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RecordHeader } from '../../../../../shared/components/StudioDetail/RecordHeader';
import type { BitbucketParticipant, BitbucketPullRequest } from '../../client';
import type { BitbucketPrActionBusy } from '../PrDetailPanel/usePrActions';
import { usePrVerbs } from './index';

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

type HarnessProps = Required<RenderParams>;

const Harness = ({ pullRequest, accountId, displayName, busy, canAct }: HarnessProps) => {
  const verbs = usePrVerbs({ pullRequest, accountId, displayName, busy, canAct, ...handlers });
  return (
    <RecordHeader provider="bitbucket" identifier="#42" title={pullRequest.title} verbs={verbs} />
  );
};

const renderVerbs = ({
  pullRequest = buildPr({}),
  accountId = 'acc-1',
  displayName = 'Kim Lee',
  busy = null,
  canAct = true,
}: RenderParams) => {
  Object.values(handlers).forEach((handler) => handler.mockClear());
  return render(
    <Harness
      pullRequest={pullRequest}
      accountId={accountId}
      displayName={displayName}
      busy={busy}
      canAct={canAct}
    />,
  );
};

const openMenu = () =>
  fireEvent.click(screen.getByRole('button', { name: 'More actions for #42' }));

describe('usePrVerbs', () => {
  afterEach(cleanup);

  it('sends my approval, and offers to take it back once it is recorded', () => {
    renderVerbs({});
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect(handlers.onApprove).toHaveBeenCalledTimes(1);

    cleanup();
    renderVerbs({ pullRequest: buildPr({ participants: [ME] }) });
    fireEvent.click(screen.getByRole('button', { name: 'Revoke approval' }));
    expect(handlers.onUnapprove).toHaveBeenCalledTimes(1);
  });

  it('keeps request changes in the menu and swaps it for a withdrawal once I asked', () => {
    renderVerbs({
      pullRequest: buildPr({
        participants: [{ ...ME, approved: false, state: 'changes_requested' }],
      }),
    });
    expect(screen.queryByRole('button', { name: 'Withdraw request' })).toBeNull();
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Withdraw request' }));
    expect(handlers.onWithdrawChanges).toHaveBeenCalledTimes(1);
    expect(handlers.onRequestChanges).not.toHaveBeenCalled();
  });

  it('keeps the vote on screen and says why it is off when the account is unknown', () => {
    renderVerbs({ accountId: null, displayName: null, pullRequest: buildPr({ participants: [] }) });
    const approve = screen.getByRole('button', { name: 'Approve' });
    expect(approve.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(approve);
    expect(handlers.onApprove).not.toHaveBeenCalled();
  });

  it('asks before it merges, next to the actions', async () => {
    renderVerbs({});
    fireEvent.click(screen.getByRole('button', { name: 'Merge' }));
    expect(handlers.onMerge).not.toHaveBeenCalled();
    expect(screen.getByRole('group', { name: 'Merge this pull request?' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm merge' }));
    await waitFor(() => expect(handlers.onMerge).toHaveBeenCalledTimes(1));
  });

  it('keeps Decline last in the menu, behind a confirm', async () => {
    renderVerbs({});
    expect(screen.queryByRole('button', { name: 'Decline' })).toBeNull();
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Decline…' }));
    expect(handlers.onDecline).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(handlers.onDecline).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Decline…' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm decline' }));
    await waitFor(() => expect(handlers.onDecline).toHaveBeenCalledTimes(1));
  });

  it('refuses the merge confirm while another write is in flight', () => {
    renderVerbs({ busy: 'approve' });
    fireEvent.click(screen.getByRole('button', { name: 'Merge' }));
    expect(screen.queryByRole('group', { name: 'Merge this pull request?' })).toBeNull();
  });

  it.each(['MERGED', 'DECLINED', 'SUPERSEDED'] as const)('offers no verb once %s', (state) => {
    renderVerbs({ pullRequest: buildPr({ state }) });

    expect(screen.queryByRole('button', { name: 'Merge' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'More actions for #42' })).toBeNull();
  });
});
