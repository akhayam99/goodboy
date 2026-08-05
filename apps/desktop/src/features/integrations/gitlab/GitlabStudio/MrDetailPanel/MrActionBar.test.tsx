import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { GitlabMergeRequest, GitlabMrApprovalState } from '../../client';
import { MrActionBar } from './MrActionBar';

const makeMr = (overrides: Partial<GitlabMergeRequest> = {}): GitlabMergeRequest => ({
  id: 1,
  iid: 4,
  projectId: 9,
  title: 'Add merge request dashboard',
  description: null,
  state: 'opened',
  webUrl: 'https://gitlab.com/acme/web/-/merge_requests/4',
  sourceBranch: 'ak/gitlab-dashboard',
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

const baseProps = {
  mr: makeMr(),
  busy: null,
  isApprovalBusy: false,
  canAct: true,
  onApprove: vi.fn(),
  onUnapprove: vi.fn(),
  onToggleDraft: vi.fn(),
  onClose: vi.fn(),
  onReopen: vi.fn(),
};

describe('MrActionBar', () => {
  afterEach(() => cleanup());

  it('hides the vote button when the GitLab instance has no approvals endpoint', () => {
    render(<MrActionBar {...baseProps} approval={null} isSupported={false} approvalError={null} />);

    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
  });

  it('renders the vote button disabled with a reason on a transient approval fetch error', () => {
    render(
      <MrActionBar
        {...baseProps}
        approval={null}
        isSupported
        approvalError="Network request failed"
      />,
    );

    const button = screen.getByRole('button', { name: 'Approve' });
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.getAttribute('title')).toBe('Network request failed');
  });

  it('renders the vote button disabled when the user cannot approve their own merge request', () => {
    render(
      <MrActionBar
        {...baseProps}
        approval={makeApproval({ userCanApprove: false })}
        isSupported
        approvalError={null}
      />,
    );

    const button = screen.getByRole('button', { name: 'Approve' });
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.getAttribute('title')).toBe(
      'You do not have permission to approve this merge request.',
    );
  });

  it('renders the vote button enabled when the user can approve', () => {
    render(
      <MrActionBar
        {...baseProps}
        approval={makeApproval({ userCanApprove: true })}
        isSupported
        approvalError={null}
      />,
    );

    const button = screen.getByRole('button', { name: 'Approve' });
    expect(button.getAttribute('aria-disabled')).toBe('false');
  });
});
