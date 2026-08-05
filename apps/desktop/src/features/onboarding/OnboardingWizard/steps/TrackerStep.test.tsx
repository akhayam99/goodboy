// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { WorkspaceId } from '@goodboy/types';

vi.mock('../../../integrations/linear/LinearFormBody', () => ({
  LinearFormBody: ({ workspaceId }: { workspaceId: WorkspaceId }) => (
    <div data-testid="linear-form">{workspaceId}</div>
  ),
}));

vi.mock('../../../integrations/jira/JiraFormBody', () => ({
  JiraFormBody: ({ workspaceId }: { workspaceId: WorkspaceId }) => (
    <div data-testid="jira-form">{workspaceId}</div>
  ),
}));

const WS_ID = 'ws-1' as WorkspaceId;

afterEach(cleanup);

import { TrackerStep } from './TrackerStep';

describe('TrackerStep', () => {
  it('renders the heading', () => {
    render(<TrackerStep workspaceId={WS_ID} linearConnected={false} jiraConnected={false} />);
    expect(screen.getByRole('heading', { name: /connect your issue tracker/i })).toBeDefined();
  });

  describe('with a workspace', () => {
    beforeEach(() => {
      render(<TrackerStep workspaceId={WS_ID} linearConnected={false} jiraConnected={false} />);
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
  });

  describe('without a workspace', () => {
    beforeEach(() => {
      render(<TrackerStep workspaceId={null} linearConnected={false} jiraConnected={false} />);
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
