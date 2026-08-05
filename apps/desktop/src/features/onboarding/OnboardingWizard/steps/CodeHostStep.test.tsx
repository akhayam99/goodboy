// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { WorkspaceId } from '@goodboy/types';

vi.mock('../../../integrations/github/GithubFormBody', () => ({
  GithubFormBody: ({ workspaceId }: { workspaceId: WorkspaceId }) => (
    <div data-testid="github-form">{workspaceId}</div>
  ),
}));

vi.mock('../../../integrations/gitlab/GitlabFormBody', () => ({
  GitlabFormBody: ({ workspaceId }: { workspaceId: WorkspaceId }) => (
    <div data-testid="gitlab-form">{workspaceId}</div>
  ),
}));

vi.mock('../../../integrations/bitbucket/BitbucketFormBody', () => ({
  BitbucketFormBody: ({ workspaceId }: { workspaceId: WorkspaceId }) => (
    <div data-testid="bitbucket-form">{workspaceId}</div>
  ),
}));

const WS_ID = 'ws-1' as WorkspaceId;

afterEach(cleanup);

import { CodeHostStep } from './CodeHostStep';

describe('CodeHostStep', () => {
  it('renders the heading', () => {
    render(
      <CodeHostStep
        workspaceId={WS_ID}
        githubConnected={false}
        gitlabConnected={false}
        bitbucketConnected={false}
        onConnected={vi.fn()}
      />,
    );
    expect(screen.getByRole('heading', { name: /connect a code host/i })).toBeDefined();
  });

  describe('with a workspace', () => {
    it('renders only the GitHub form by default', () => {
      render(
        <CodeHostStep
          workspaceId={WS_ID}
          githubConnected={false}
          gitlabConnected={false}
          bitbucketConnected={false}
          onConnected={vi.fn()}
        />,
      );
      expect(screen.getByTestId('github-form').textContent).toBe(WS_ID);
      expect(screen.queryByTestId('gitlab-form')).toBeNull();
      expect(screen.queryByText(/Add a workspace first/i)).toBeNull();
    });

    it('swaps to the GitLab form when its segment is selected', () => {
      render(
        <CodeHostStep
          workspaceId={WS_ID}
          githubConnected={false}
          gitlabConnected={false}
          bitbucketConnected={false}
          onConnected={vi.fn()}
        />,
      );
      fireEvent.click(screen.getByRole('tab', { name: /gitlab/i }));
      expect(screen.getByTestId('gitlab-form').textContent).toBe(WS_ID);
      expect(screen.queryByTestId('github-form')).toBeNull();
    });

    it('swaps to the Bitbucket form when its segment is selected', () => {
      render(
        <CodeHostStep
          workspaceId={WS_ID}
          githubConnected={false}
          gitlabConnected={false}
          bitbucketConnected={false}
          onConnected={vi.fn()}
        />,
      );
      fireEvent.click(screen.getByRole('tab', { name: /bitbucket/i }));
      expect(screen.getByTestId('bitbucket-form').textContent).toBe(WS_ID);
      expect(screen.queryByTestId('github-form')).toBeNull();
      expect(screen.queryByTestId('gitlab-form')).toBeNull();
    });

    it('defaults to Bitbucket when only Bitbucket is connected', () => {
      render(
        <CodeHostStep
          workspaceId={WS_ID}
          githubConnected={false}
          gitlabConnected={false}
          bitbucketConnected
          onConnected={vi.fn()}
        />,
      );
      expect(screen.getByTestId('bitbucket-form').textContent).toBe(WS_ID);
      expect(screen.queryByTestId('github-form')).toBeNull();
    });

    it('defaults to GitLab when only GitLab is connected', () => {
      render(
        <CodeHostStep
          workspaceId={WS_ID}
          githubConnected={false}
          gitlabConnected
          bitbucketConnected={false}
          onConnected={vi.fn()}
        />,
      );
      expect(screen.getByTestId('gitlab-form').textContent).toBe(WS_ID);
      expect(screen.queryByTestId('github-form')).toBeNull();
    });
  });

  describe('without a workspace', () => {
    beforeEach(() => {
      render(
        <CodeHostStep
          workspaceId={null}
          githubConnected={false}
          gitlabConnected={false}
          bitbucketConnected={false}
          onConnected={vi.fn()}
        />,
      );
    });

    it('shows the add-workspace empty state instead of the forms', () => {
      expect(screen.getByText(/Add a workspace first to connect a code host/i)).toBeDefined();
      expect(screen.queryByTestId('github-form')).toBeNull();
      expect(screen.queryByTestId('gitlab-form')).toBeNull();
      expect(screen.queryByTestId('bitbucket-form')).toBeNull();
    });

    it('dispatches goodboy:add-workspace when the Add workspace button is clicked', () => {
      const spy = vi.fn();
      window.addEventListener('goodboy:add-workspace', spy);
      fireEvent.click(screen.getByRole('button', { name: /add workspace/i }));
      expect(spy).toHaveBeenCalledOnce();
      window.removeEventListener('goodboy:add-workspace', spy);
    });
  });
});
