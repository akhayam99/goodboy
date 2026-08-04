import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { GithubIssue, WorkspaceId } from '@goodboy/types';

const h = vi.hoisted(() => ({
  ghUpdateIssueBody: vi.fn(),
}));

vi.mock('../github', () => ({ ghUpdateIssueBody: h.ghUpdateIssueBody }));

import { GithubIssueDetail } from './index';

const ISSUE: GithubIssue = {
  number: 42,
  title: 'Add issue dashboard',
  body: 'Show assigned issues in GitHub Studio.',
  url: 'https://github.com/goodboy/goodboy/issues/42',
  state: 'OPEN',
  labels: ['feature'],
  updatedAt: '2026-07-22T10:00:00Z',
};

const EDIT_CONTEXT = {
  workspaceId: 'workspace-1' as WorkspaceId,
  rootPath: '/repo',
};

afterEach(() => {
  h.ghUpdateIssueBody.mockReset();
  cleanup();
});

describe('GithubIssueDetail', () => {
  it('renders the issue title, description and properties', () => {
    render(<GithubIssueDetail issue={ISSUE} />);

    expect(screen.getByText('Add issue dashboard')).toBeDefined();
    expect(screen.getByText('Show assigned issues in GitHub Studio.')).toBeDefined();
    expect(screen.getByText('feature')).toBeDefined();
    expect(screen.getByText('#42')).toBeDefined();
  });

  it('falls back to a placeholder when the body is empty', () => {
    render(<GithubIssueDetail issue={{ ...ISSUE, body: '' }} />);

    expect(screen.getByText('No description.')).toBeDefined();
  });

  it('offers no description editing without an edit context', () => {
    render(<GithubIssueDetail issue={ISSUE} />);

    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
  });

  it('writes the edited description to GitHub and shows the stored body', async () => {
    h.ghUpdateIssueBody.mockResolvedValueOnce('Rewritten from Goodboy.');
    render(<GithubIssueDetail issue={ISSUE} editContext={EDIT_CONTEXT} />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Edit description' }), {
      target: { value: 'Rewritten from Goodboy.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(h.ghUpdateIssueBody).toHaveBeenCalledWith({
        cwd: '/repo',
        issueNumber: 42,
        body: 'Rewritten from Goodboy.',
        workspaceId: 'workspace-1',
      }),
    );
    await waitFor(() => expect(screen.getByText('Rewritten from Goodboy.')).toBeDefined());
    expect(screen.queryByText('Show assigned issues in GitHub Studio.')).toBeNull();
  });
});
