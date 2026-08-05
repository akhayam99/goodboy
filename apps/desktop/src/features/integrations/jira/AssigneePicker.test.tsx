// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceId } from '@goodboy/types';
import { jiraListAssignableUsers, type JiraUser } from './client';

const h = vi.hoisted(() => ({
  config: {
    siteUrl: 'https://acme.atlassian.net',
    email: 'grace@acme.com',
    projectKey: 'ENG',
  } as unknown,
}));

vi.mock('./useJiraConfig', () => ({ useJiraConfig: () => h.config }));
vi.mock('./client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./client')>()),
  jiraListAssignableUsers: vi.fn(async () => []),
}));

import { AssigneePicker } from './AssigneePicker';

const listAssignableUsers = vi.mocked(jiraListAssignableUsers);

const GRACE: JiraUser = {
  accountId: 'a1',
  displayName: 'Grace Hopper',
  emailAddress: null,
  avatarUrls: null,
  active: true,
};

const ADA: JiraUser = { ...GRACE, accountId: 'a2', displayName: 'Ada Lovelace' };

const WORKSPACE = 'workspace-1' as WorkspaceId;

type MountParams = {
  readonly assignee: JiraUser | null;
  readonly onAssign: (accountId: string | null) => Promise<void>;
};

const mount = ({ assignee, onAssign }: MountParams) =>
  render(
    <AssigneePicker
      issueKey="ENG-142"
      workspaceId={WORKSPACE}
      assignee={assignee}
      onAssign={onAssign}
    />,
  );

beforeEach(() => {
  vi.clearAllMocks();
  listAssignableUsers.mockResolvedValue([GRACE, ADA]);
});
afterEach(cleanup);

describe('AssigneePicker', () => {
  it('reads the candidates only once the picker is opened, and filters them by name', async () => {
    mount({ assignee: GRACE, onAssign: vi.fn(async () => {}) });

    expect(listAssignableUsers).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Grace Hopper' }));
    await screen.findByRole('menuitem', { name: 'Ada Lovelace' });
    fireEvent.change(screen.getByLabelText('Filter assignable people'), {
      target: { value: 'ada' },
    });

    expect(screen.queryByRole('menuitem', { name: 'Grace Hopper' })).toBeNull();
    expect(screen.getByRole('menuitem', { name: 'Ada Lovelace' })).toBeDefined();
  });

  it('offers no unassign row when nobody owns the issue', async () => {
    mount({ assignee: null, onAssign: vi.fn(async () => {}) });

    fireEvent.click(screen.getByRole('button', { name: 'Unassigned' }));
    await screen.findByRole('menuitem', { name: 'Ada Lovelace' });

    expect(screen.queryByRole('menuitem', { name: 'Unassign' })).toBeNull();
  });

  it('keeps the picker mounted and shows the failure when Jira refuses the change', async () => {
    mount({
      assignee: GRACE,
      onAssign: vi.fn(async () => {
        throw new Error('User cannot be assigned issues');
      }),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Grace Hopper' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Ada Lovelace' }));

    expect((await screen.findByRole('alert')).textContent).toContain('cannot be assigned');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Grace Hopper' })).toBeDefined());
  });
});
