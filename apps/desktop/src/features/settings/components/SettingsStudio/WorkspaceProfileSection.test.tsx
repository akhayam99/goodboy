// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { WorkspaceId, WorkspaceProfile } from '@goodboy/types';

const WORKSPACE_ID = 'ws-harborline' as WorkspaceId;

const { state } = vi.hoisted(() => ({
  state: {
    workspaces: [] as ReadonlyArray<{ id: string; profile?: WorkspaceProfile }>,
    updateWorkspaceProfile: vi.fn(async () => undefined),
    reportError: vi.fn(async () => undefined),
  },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

import { WorkspaceProfileSection } from './WorkspaceProfileSection';

beforeEach(() => {
  vi.clearAllMocks();
  state.workspaces = [
    {
      id: WORKSPACE_ID,
      profile: {
        roles: ['Tech Lead'],
        aboutWork: 'Leads the payments platform team.',
        workingRules: null,
        explainMore: [],
      },
    },
  ];
});
afterEach(cleanup);

describe('WorkspaceProfileSection', () => {
  it('shows the stored fields under About you', () => {
    render(<WorkspaceProfileSection workspaceId={WORKSPACE_ID} />);

    expect(screen.getByRole('heading', { name: /about you/i })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Remove Tech Lead' })).toBeDefined();
    expect((screen.getByLabelText(/About your work/) as HTMLTextAreaElement).value).toBe(
      'Leads the payments platform team.',
    );
  });

  it('saves the trimmed profile when a text field loses focus', async () => {
    render(<WorkspaceProfileSection workspaceId={WORKSPACE_ID} />);
    const rules = screen.getByLabelText('How agents should work with you');

    fireEvent.change(rules, { target: { value: '  Keep pull requests small.  ' } });
    fireEvent.blur(rules);

    await waitFor(() =>
      expect(state.updateWorkspaceProfile).toHaveBeenCalledWith({
        workspaceId: WORKSPACE_ID,
        profile: {
          roles: ['Tech Lead'],
          aboutWork: 'Leads the payments platform team.',
          workingRules: 'Keep pull requests small.',
          explainMore: [],
        },
      }),
    );
  });

  it('spends no write when nothing changed', () => {
    render(<WorkspaceProfileSection workspaceId={WORKSPACE_ID} />);

    fireEvent.blur(screen.getByLabelText(/About your work/));

    expect(state.updateWorkspaceProfile).not.toHaveBeenCalled();
  });

  it('saves right away when a role is removed', async () => {
    render(<WorkspaceProfileSection workspaceId={WORKSPACE_ID} />);

    fireEvent.click(screen.getByRole('button', { name: 'Remove Tech Lead' }));

    await waitFor(() =>
      expect(state.updateWorkspaceProfile).toHaveBeenCalledWith(
        expect.objectContaining({ profile: expect.objectContaining({ roles: [] }) }),
      ),
    );
  });
});
