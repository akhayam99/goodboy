import { afterEach, describe, expect, it, vi } from 'vitest';
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

const h = vi.hoisted(() => ({
  listComments: vi.fn(async () => [
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
  ]),
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
}));

vi.mock('../../client', () => ({
  bitbucketListPullRequestComments: h.listComments,
  bitbucketListPullRequestStatuses: h.listStatuses,
  bitbucketPullRequestDiff: h.diff,
}));

vi.mock('../../../components/LaunchSessionPanel', () => ({
  LaunchSessionPanel: () => <div>Launch panel</div>,
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

const renderPanel = () =>
  render(
    <PrDetailPanel
      pullRequest={PR}
      repo={REPO}
      sessionId={'sess-1' as SessionId}
      workspaceId={'ws-1' as WorkspaceId}
      isLoading={false}
      error={null}
      onRefresh={() => undefined}
      onClose={() => undefined}
    />,
  );

describe('PrDetailPanel', () => {
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

  it('lists the review comments read only, with no composer', async () => {
    renderPanel();
    fireEvent.click(screen.getByRole('tab', { name: /conversation/i }));
    await waitFor(() => expect(screen.getByText(/one nit on the fuel constant/)).toBeTruthy());
    expect(screen.queryByRole('textbox')).toBeNull();
  });
});
