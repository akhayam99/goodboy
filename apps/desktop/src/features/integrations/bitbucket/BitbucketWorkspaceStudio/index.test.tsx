// @vitest-environment happy-dom

import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { ToastProvider } from '../../../../app/components/Toast';
import type { BitbucketPullRequest, BitbucketRepo } from '../client';
import type { BitbucketPrGroup } from '../BitbucketStudio/useBitbucketPrs';

const h = vi.hoisted(() => ({
  integrations: {} as Record<string, ReadonlyArray<{ provider: string }>>,
  repo: null as BitbucketRepo | null,
  groups: [] as ReadonlyArray<BitbucketPrGroup>,
  repoHookEnabled: null as boolean | null,
  detailSessionId: undefined as SessionId | null | undefined,
  disconnectBitbucket: vi.fn(async () => undefined),
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  useAppStore: <T,>(
    selector: (state: {
      workspaceIntegrations: typeof h.integrations;
      disconnectBitbucket: typeof h.disconnectBitbucket;
    }) => T,
  ) =>
    selector({ workspaceIntegrations: h.integrations, disconnectBitbucket: h.disconnectBitbucket }),
}));

vi.mock('../../../../shared/components/StudioShell', () => ({
  StudioShell: ({
    children,
    headerAccessory,
  }: {
    children: (requestClose: () => void) => ReactNode;
    headerAccessory?: ReactNode;
  }) => (
    <div>
      {headerAccessory}
      {children(vi.fn())}
    </div>
  ),
}));

vi.mock('../useWorkspaceBitbucketRepo', () => ({
  useWorkspaceBitbucketRepo: (params: { isEnabled: boolean }) => {
    h.repoHookEnabled = params.isEnabled;
    return h.repo;
  },
}));

vi.mock('../BitbucketStudio/useBitbucketPrs', () => ({
  useBitbucketPrs: () => ({
    groups: h.groups,
    loading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock('../BitbucketStudio/PrDetailPanel', () => ({
  PrDetailPanel: ({
    pullRequest,
    sessionId,
  }: {
    pullRequest: BitbucketPullRequest | null;
    sessionId: SessionId | null;
  }) => {
    h.detailSessionId = sessionId;
    return <div data-testid="detail">{pullRequest?.title ?? 'none'}</div>;
  },
}));

vi.mock('../BitbucketFormBody', () => ({
  BitbucketFormBody: () => (
    <label htmlFor="bitbucket-token-test">
      App password
      <input id="bitbucket-token-test" />
    </label>
  ),
}));

import { BitbucketWorkspaceStudio } from '.';

type PullRequestParams = {
  readonly id: number;
  readonly title: string;
};

const pullRequest = ({ id, title }: PullRequestParams): BitbucketPullRequest => ({
  id,
  title,
  description: '',
  state: 'OPEN',
  createdOn: '2026-08-05T09:00:00Z',
  updatedOn: '2026-08-05T09:00:00Z',
  sourceBranch: 'feat/x',
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
});

const renderStudio = () =>
  render(
    <ToastProvider>
      <BitbucketWorkspaceStudio
        workspaceId={'workspace-1' as WorkspaceId}
        workspaceName="Goodboy"
        onClose={vi.fn()}
      />
    </ToastProvider>,
  );

beforeEach(() => {
  h.integrations = {};
  h.repo = null;
  h.groups = [];
  h.repoHookEnabled = null;
  h.detailSessionId = undefined;
});
afterEach(() => {
  cleanup();
  h.disconnectBitbucket.mockReset();
});

describe('BitbucketWorkspaceStudio', () => {
  it('asks for the connection before resolving a repository', () => {
    renderStudio();

    expect(
      screen.getByText('Connect Bitbucket to review pull requests from this workspace'),
    ).toBeDefined();
    expect(screen.getByLabelText('App password')).toBeDefined();
    expect(h.repoHookEnabled).toBe(false);
  });

  it('says the workspace has no Bitbucket remote when the repo does not resolve', () => {
    h.integrations = { 'workspace-1': [{ provider: 'bitbucket' }] };

    renderStudio();

    expect(h.repoHookEnabled).toBe(true);
    expect(screen.getByText('No Bitbucket repository here')).toBeDefined();
  });

  it('lists pull requests read-only, with no session behind the detail panel', () => {
    h.integrations = { 'workspace-1': [{ provider: 'bitbucket' }] };
    h.repo = {
      workspaceId: 'workspace-1' as WorkspaceId,
      workspaceSlug: 'acme',
      repoSlug: 'goodboy',
      email: 'dev@acme.test',
    };
    h.groups = [
      { key: 'Open', label: 'Open', rows: [pullRequest({ id: 7, title: 'fix billing webhook' })] },
    ];

    renderStudio();

    expect(screen.getByTestId('detail').textContent).toBe('fix billing webhook');
    expect(h.detailSessionId).toBeNull();
  });

  it('disconnects Bitbucket from the header once connected', async () => {
    h.integrations = { 'workspace-1': [{ provider: 'bitbucket' }] };

    renderStudio();

    fireEvent.click(screen.getByRole('button', { name: 'Disconnect Bitbucket' }));
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect Bitbucket' }));

    await vi.waitFor(() =>
      expect(h.disconnectBitbucket).toHaveBeenCalledWith({ workspaceId: 'workspace-1' }),
    );
  });
});
