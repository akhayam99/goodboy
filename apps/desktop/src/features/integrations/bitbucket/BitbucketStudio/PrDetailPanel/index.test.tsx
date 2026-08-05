import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import type { BitbucketPullRequest } from '../../client';

const RAW_DIFF = `diff --git a/src/rocket.ts b/src/rocket.ts
index 1111111..2222222 100644
--- a/src/rocket.ts
+++ b/src/rocket.ts
@@ -1,3 +1,3 @@
 const thrust = 1;
-const fuel = 0;
+const fuel = 100;
 export { thrust, fuel };
`;

type WriteSpy = (params: Record<string, unknown>) => Promise<void>;

const h = vi.hoisted(() => ({
  listComments: vi.fn(async (target: { readonly pullRequestId: number }) => {
    if (target.pullRequestId !== 42) {
      return new Promise<ReadonlyArray<unknown>>(() => undefined);
    }
    return [
      {
        id: 5,
        body: 'This looks close, one nit on the fuel constant.',
        user: { uuid: 'u1', accountId: null, nickname: 'kim', displayName: 'Kim', avatarUrl: null },
        createdOn: '2026-08-01T10:00:00Z',
        updatedOn: '2026-08-01T10:00:00Z',
        deleted: false,
        parentId: null,
        inline: null,
        webUrl: null,
      },
    ];
  }),
  listStatuses: vi.fn(async () => [
    {
      key: 'PIPELINE',
      name: 'unit tests',
      state: 'FAILED' as const,
      url: null,
      description: null,
      refname: null,
      createdOn: '2026-08-01T10:00:00Z',
      updatedOn: '2026-08-01T10:01:00Z',
    },
    {
      key: 'LINT',
      name: 'lint',
      state: 'INPROGRESS' as const,
      url: null,
      description: null,
      refname: null,
      createdOn: '2026-08-01T10:00:00Z',
      updatedOn: '2026-08-01T10:01:00Z',
    },
  ]),
  diff: vi.fn(async () => RAW_DIFF),
  showToast: vi.fn(),
  state: {
    workspaceIntegrations: {
      'ws-1': [
        {
          provider: 'bitbucket',
          config: { workspaceSlug: 'acme', email: 'dev@acme.test', accountId: 'acc-1' },
        },
      ],
    },
    approveBitbucketPr: vi.fn<WriteSpy>(async () => undefined),
    unapproveBitbucketPr: vi.fn<WriteSpy>(async () => undefined),
    requestBitbucketPrChanges: vi.fn<WriteSpy>(async () => undefined),
    withdrawBitbucketPrChanges: vi.fn<WriteSpy>(async () => undefined),
    mergeBitbucketPr: vi.fn<WriteSpy>(async () => undefined),
    declineBitbucketPr: vi.fn<WriteSpy>(async () => undefined),
    commentOnBitbucketPr: vi.fn<WriteSpy>(async () => undefined),
    replyToBitbucketPrComment: vi.fn<WriteSpy>(async () => undefined),
  },
}));

vi.mock('../../client', () => ({
  bitbucketListPullRequestComments: h.listComments,
  bitbucketListPullRequestStatuses: h.listStatuses,
  bitbucketPullRequestDiff: h.diff,
}));

vi.mock('../../../components/LaunchSessionPanel', () => ({
  LaunchSessionPanel: () => <div>Launch panel</div>,
}));

vi.mock('../../../../../store', () => ({
  EMPTY_ARRAY: [],
  useAppStore: <T,>(selector: (s: typeof h.state) => T) => selector(h.state),
}));

vi.mock('../../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast: h.showToast }),
}));

const { PrDetailPanel } = await import('./index');

const PR: BitbucketPullRequest = {
  id: 42,
  title: 'Raise the fuel constant',
  description: 'The tank was empty.',
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
  commentCount: 1,
  taskCount: 0,
  webUrl: null,
};

const REPO = {
  workspaceId: 'ws-1' as WorkspaceId,
  workspaceSlug: 'acme',
  repoSlug: 'rocket',
  email: 'dev@acme.test',
};

const panel = (pullRequest: BitbucketPullRequest) => (
  <PrDetailPanel
    pullRequest={pullRequest}
    repo={REPO}
    sessionId={'sess-1' as SessionId}
    workspaceId={'ws-1' as WorkspaceId}
    isLoading={false}
    error={null}
    onRefresh={() => undefined}
    onClose={() => undefined}
  />
);

const renderPanel = () => render(panel(PR));

const writeSpies = () => [
  h.state.approveBitbucketPr,
  h.state.unapproveBitbucketPr,
  h.state.requestBitbucketPrChanges,
  h.state.withdrawBitbucketPrChanges,
  h.state.mergeBitbucketPr,
  h.state.declineBitbucketPr,
  h.state.commentOnBitbucketPr,
  h.state.replyToBitbucketPrComment,
];

const openConversation = async () => {
  fireEvent.click(screen.getByRole('tab', { name: /conversation/i }));
  await waitFor(() => expect(screen.getByText(/one nit on the fuel constant/)).toBeTruthy());
};

describe('PrDetailPanel', () => {
  beforeEach(() => {
    writeSpies().forEach((spy) => spy.mockClear());
  });
  afterEach(cleanup);

  it('shows the pull request title and description on the overview', async () => {
    renderPanel();
    expect(screen.getByText('Raise the fuel constant')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('The tank was empty.')).toBeTruthy());
  });

  it('rolls the bitbucket build statuses up into plain language above the check list', async () => {
    renderPanel();
    fireEvent.click(screen.getByRole('tab', { name: /checks/i }));
    await waitFor(() =>
      expect(screen.getByTestId('checks-rollup').textContent).toBe('1 failed, 1 in progress'),
    );
    expect(screen.getByText('unit tests')).toBeTruthy();
  });

  it('renders the changed file from the raw unified diff bitbucket returns', async () => {
    renderPanel();
    fireEvent.click(screen.getByRole('tab', { name: /changes/i }));
    await waitFor(() => expect(screen.getByText('src/rocket.ts')).toBeTruthy());
    const fileSection = document.querySelector('[data-file-path="src/rocket.ts"]');
    expect(fileSection?.textContent).toContain('const fuel = 100;');
    expect(fileSection?.textContent).toContain('const fuel = 0;');
  });

  it('sends my approval for the pull request on screen', async () => {
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    await waitFor(() =>
      expect(h.state.approveBitbucketPr).toHaveBeenCalledWith(
        expect.objectContaining({ pullRequestId: 42, repo: REPO }),
      ),
    );
  });

  it('merges only after the confirmation, and for that pull request', async () => {
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Merge' }));
    expect(h.state.mergeBitbucketPr).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm merge' }));
    await waitFor(() =>
      expect(h.state.mergeBitbucketPr).toHaveBeenCalledWith(
        expect.objectContaining({ pullRequestId: 42 }),
      ),
    );
  });

  it('posts a top level comment without a parent', async () => {
    renderPanel();
    await openConversation();
    fireEvent.change(screen.getByLabelText('Write a comment'), {
      target: { value: 'Shipping this' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Comment' }));

    await waitFor(() => expect(h.state.commentOnBitbucketPr).toHaveBeenCalledTimes(1));
    const params = h.state.commentOnBitbucketPr.mock.calls[0]?.[0];
    expect(params).toMatchObject({ pullRequestId: 42, body: 'Shipping this' });
    expect(params).not.toHaveProperty('parentCommentId');
  });

  it('answers a comment with a reply that carries its id', async () => {
    renderPanel();
    await openConversation();
    fireEvent.click(screen.getByRole('button', { name: 'Reply' }));
    fireEvent.change(screen.getByLabelText('Write a reply'), { target: { value: 'Fixed it' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reply' }));

    await waitFor(() =>
      expect(h.state.replyToBitbucketPrComment).toHaveBeenCalledWith(
        expect.objectContaining({ pullRequestId: 42, parentCommentId: 5, body: 'Fixed it' }),
      ),
    );
    expect(h.state.commentOnBitbucketPr).not.toHaveBeenCalled();
  });

  it('never paints the previous pull request conversation while the next one loads', async () => {
    const view = render(panel(PR));
    fireEvent.click(screen.getByRole('tab', { name: /conversation/i }));
    await waitFor(() => expect(screen.getByText(/one nit on the fuel constant/)).toBeTruthy());

    view.rerender(panel({ ...PR, id: 43, title: 'Another one' }));

    expect(screen.queryByText(/one nit on the fuel constant/)).toBeNull();
    expect(screen.getByRole('status', { name: 'Loading the conversation' })).toBeTruthy();
  });
});
