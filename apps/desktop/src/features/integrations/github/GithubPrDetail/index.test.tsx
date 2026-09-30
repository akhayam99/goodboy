import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { PullRequestState, WorkspaceId } from '@goodboy/types';

const h = vi.hoisted(() => ({
  ghIssueComments: vi.fn(),
  ghCreateIssueComment: vi.fn(),
}));

vi.mock('../github', () => ({
  ghIssueComments: h.ghIssueComments,
  ghCreateIssueComment: h.ghCreateIssueComment,
}));

import { GithubPrDetail } from './index';

const PR: PullRequestState = {
  number: 12,
  title: 'Retry ledger sync',
  url: 'https://github.com/harborline/ledger-core/pull/12',
  state: 'open',
  mergeable: true,
  checks: null,
  baseBranch: 'main',
  headBranch: 'retry-sync',
  isDraft: false,
  reviewDecision: 'changes_requested',
  body: 'Retries the sync on timeout.',
  updatedAt: '2026-09-25T10:00:00Z',
};

const workspaceId = 'workspace-1' as WorkspaceId;

beforeEach(() => {
  h.ghIssueComments.mockResolvedValue([]);
});

afterEach(() => {
  h.ghIssueComments.mockReset();
  h.ghCreateIssueComment.mockReset();
  cleanup();
});

describe('GithubPrDetail', () => {
  it('renders the pull request header, description and review facts', () => {
    render(
      <GithubPrDetail pr={PR} role="review-requested" workspaceId={workspaceId} rootPath="/repo" />,
    );

    expect(screen.getByText('Retry ledger sync')).toBeDefined();
    expect(screen.getByText('#12')).toBeDefined();
    expect(screen.getByText('Retries the sync on timeout.')).toBeDefined();
    expect(screen.getByText('Changes requested')).toBeDefined();
    expect(screen.getByText('retry-sync › main')).toBeDefined();
    expect(screen.getByText(/Your review is requested/)).toBeDefined();
  });

  it('loads the pull request conversation from the repo', () => {
    render(<GithubPrDetail pr={PR} role="author" workspaceId={workspaceId} rootPath="/repo" />);

    expect(screen.getByText(/Your pull request/)).toBeDefined();
    expect(h.ghIssueComments).toHaveBeenCalled();
  });
});
