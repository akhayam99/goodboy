// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { WorkspaceId } from '@goodboy/types';

type FormBodyMockProps = {
  readonly workspaceId: WorkspaceId;
};

vi.mock('../../../integrations/linear/LinearFormBody', () => ({
  LinearFormBody: ({ workspaceId }: FormBodyMockProps) => (
    <div data-testid="linear-form">{workspaceId}</div>
  ),
}));

vi.mock('../../../integrations/jira/JiraFormBody', () => ({
  JiraFormBody: ({ workspaceId }: FormBodyMockProps) => (
    <div data-testid="jira-form">{workspaceId}</div>
  ),
}));

vi.mock('../../../integrations/slack/SlackFormBody', () => ({
  SlackFormBody: ({ workspaceId }: FormBodyMockProps) => (
    <div data-testid="slack-form">{workspaceId}</div>
  ),
}));

const WS_ID = 'ws-1' as WorkspaceId;

afterEach(cleanup);

import { TrackerStep } from './TrackerStep';

describe('TrackerStep', () => {
  it('renders the heading', () => {
    render(
      <TrackerStep
        workspaceId={WS_ID}
        linearConnected={false}
        jiraConnected={false}
        slackConnected={false}
      />,
    );
    expect(screen.getByRole('heading', { name: /connect your tools/i })).toBeDefined();
  });

  describe('with a workspace', () => {
    beforeEach(() => {
      render(
        <TrackerStep
          workspaceId={WS_ID}
          linearConnected={false}
          jiraConnected={false}
          slackConnected={false}
        />,
      );
    });

    it('renders the Linear form scoped to the workspace', () => {
      expect(screen.getByTestId('linear-form').textContent).toBe(WS_ID);
      expect(screen.queryByText(/Add a workspace first/i)).toBeNull();
    });

    it('swaps in the Jira form when the Jira segment is picked', () => {
      const jira = screen.getByRole('tab', { name: /jira/i });
      expect(jira.hasAttribute('disabled')).toBe(false);
      fireEvent.click(jira);
      expect(screen.getByTestId('jira-form').textContent).toBe(WS_ID);
      expect(screen.queryByTestId('linear-form')).toBeNull();
    });

    it('swaps in the Slack form when the Slack segment is picked', () => {
      const slack = screen.getByRole('tab', { name: /slack/i });
      expect(slack.hasAttribute('disabled')).toBe(false);
      fireEvent.click(slack);
      expect(screen.getByTestId('slack-form').textContent).toBe(WS_ID);
      expect(screen.queryByTestId('linear-form')).toBeNull();
    });
  });

  describe('without a workspace', () => {
    beforeEach(() => {
      render(
        <TrackerStep
          workspaceId={null}
          linearConnected={false}
          jiraConnected={false}
          slackConnected={false}
        />,
      );
    });

    it('shows the add-workspace empty state instead of the form', () => {
      expect(screen.getByText(/Add a workspace first to connect your tracker/i)).toBeDefined();
      expect(screen.queryByTestId('linear-form')).toBeNull();
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
