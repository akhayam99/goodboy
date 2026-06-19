// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { WorkspaceId } from '@goodboy/types';

vi.mock('../../../integrations/sentry/SentryFormBody', () => ({
  SentryFormBody: ({ workspaceId }: { workspaceId: WorkspaceId }) => (
    <div data-testid="sentry-form">{workspaceId}</div>
  ),
}));

const WS_ID = 'ws-1' as WorkspaceId;

afterEach(cleanup);

import { SentryStep } from './SentryStep';

describe('SentryStep', () => {
  it('renders the heading', () => {
    render(<SentryStep workspaceId={WS_ID} />);
    expect(screen.getByRole('heading', { name: /triage errors with sentry/i })).toBeDefined();
  });

  describe('with a workspace', () => {
    it('renders the Sentry form scoped to the workspace', () => {
      render(<SentryStep workspaceId={WS_ID} />);
      expect(screen.getByTestId('sentry-form').textContent).toBe(WS_ID);
      expect(screen.queryByText(/Add a workspace first/i)).toBeNull();
    });
  });

  describe('without a workspace', () => {
    beforeEach(() => {
      render(<SentryStep workspaceId={null} />);
    });

    it('shows the add-workspace empty state instead of the form', () => {
      expect(screen.getByText(/Add a workspace first to connect Sentry/i)).toBeDefined();
      expect(screen.queryByTestId('sentry-form')).toBeNull();
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
