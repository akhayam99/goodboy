// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../../shared/lib/db', async () =>
  (await import('../../../../../store/storyHarness')).sqliteDbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { getProjectById, insertProject, insertWorkspace } from '@goodboy/db';
import type {
  AgentRole,
  IsoDateTime,
  OverrideSettings,
  Project,
  RoleModelPreference,
  WorkspaceId,
} from '@goodboy/types';
import { EMPTY_OVERRIDES, aProject } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  buildStoryWorkspace,
  importStore,
  injectDbFault,
  openStorySqlite,
  resetStoryStore,
  storySqlite,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { ProjectOverridesNotice } from './ProjectOverridesNotice';

const WORKSPACE_ID = 'workspace-harborline' as WorkspaceId;
const OTHER_WORKSPACE_ID = 'workspace-northwind' as WorkspaceId;

const PIN: RoleModelPreference = {
  providerId: 'anthropic',
  model: 'claude-sonnet-5',
  effort: 'medium',
};

const ROLES: ReadonlyArray<AgentRole> = [
  'scout',
  'planner',
  'implementer',
  'reviewer',
  'tester',
  'resolver',
];

const PINNED: OverrideSettings = {
  ...EMPTY_OVERRIDES,
  taskModels: {
    workflow_orchestrator: { providerId: 'anthropic', model: 'claude-sonnet-5' },
    summarizer: { providerId: 'anthropic', model: 'claude-sonnet-4-5' },
  },
  roleModels: Object.fromEntries(ROLES.map((role) => [role, PIN])),
};

const PAYMENTS = aProject({
  id: 'project-payments-api' as Project['id'],
  workspaceId: WORKSPACE_ID,
  name: 'payments-api',
  rootPath: '/tmp/payments-api',
  overrides: PINNED,
});

const LEDGER = aProject({
  id: 'project-ledger-core' as Project['id'],
  workspaceId: WORKSPACE_ID,
  name: 'ledger-core',
  rootPath: '/tmp/ledger-core',
  overrides: {
    ...EMPTY_OVERRIDES,
    taskModels: { rebase: { providerId: 'anthropic', model: 'claude-sonnet-5' } },
  },
});

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  const db = await openStorySqlite();
  await insertWorkspace({
    db,
    workspace: buildStoryWorkspace({ id: WORKSPACE_ID, name: 'Harborline', slug: 'harborline' }),
  });
  await insertWorkspace({
    db,
    workspace: buildStoryWorkspace({
      id: OTHER_WORKSPACE_ID,
      name: 'Northwind',
      slug: 'northwind',
    }),
  });
});

afterEach(cleanup);

const seed = async (projects: ReadonlyArray<Project>) => {
  const db = storySqlite();
  for (const project of projects) {
    await insertProject({ db, project });
  }
  useAppStore.setState({ projects });
};

const open = () => render(<ProjectOverridesNotice workspaceId={WORKSPACE_ID} />);

describe('ProjectOverridesNotice', () => {
  it('stays away when no project carries model settings', async () => {
    await seed([aProject({ workspaceId: WORKSPACE_ID, rootPath: '/tmp/a' })]);

    const { container } = open();

    expect(container.textContent).toBe('');
  });

  it('ignores projects of another workspace and disconnected ones', async () => {
    await seed([
      { ...PAYMENTS, workspaceId: OTHER_WORKSPACE_ID },
      { ...LEDGER, disconnectedAt: '2026-10-01T00:00:00.000Z' as IsoDateTime },
    ]);

    const { container } = open();

    expect(container.textContent).toBe('');
  });

  it('says which project wins and what it pins', async () => {
    await seed([PAYMENTS]);

    open();

    expect(screen.getByText('1 project has its own model settings')).toBeDefined();
    expect(
      screen.getByText(
        'It wins over this page when you work in it: orchestrator Sonnet 5, summaries Sonnet 4.5 and 6 roles in payments-api.',
      ),
    ).toBeDefined();
  });

  it('counts several projects and stops the list at three facts', async () => {
    await seed([PAYMENTS, LEDGER]);

    open();

    expect(screen.getByText('2 projects have their own model settings')).toBeDefined();
    expect(
      screen.getByText(
        'They win over this page when you work in them: orchestrator Sonnet 5 in payments-api, summaries Sonnet 4.5 in payments-api, 6 roles in payments-api and 1 more.',
      ),
    ).toBeDefined();
  });

  it('opens an anchored confirm, keeps the project on Cancel, and clears it on Clear', async () => {
    await seed([PAYMENTS]);
    open();

    fireEvent.click(screen.getByRole('button', { name: 'Use this page instead' }));
    const confirm = screen.getByRole('dialog', { name: 'Clear model settings of 1 project?' });
    expect(within(confirm).getByText(/follow this page again/)).toBeDefined();

    fireEvent.click(within(confirm).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('1 project has its own model settings')).toBeDefined();
    expect(
      (await getProjectById({ db: storySqlite(), id: PAYMENTS.id }))?.overrides.roleModels,
    ).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Use this page instead' }));
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Clear model settings of 1 project?' })).getByRole(
        'button',
        { name: 'Clear' },
      ),
    );

    await waitFor(() => expect(screen.queryByText(/has its own model settings/)).toBeNull());
    const stored = await getProjectById({ db: storySqlite(), id: PAYMENTS.id });
    expect(stored?.overrides.taskModels).toBeNull();
    expect(stored?.overrides.roleModels).toBeNull();
  });

  it('shows the reason under the confirm and keeps both buttons live when the write fails', async () => {
    await seed([PAYMENTS]);
    open();
    injectDbFault({ match: /UPDATE projects/, message: 'database is locked' });

    fireEvent.click(screen.getByRole('button', { name: 'Use this page instead' }));
    const confirm = screen.getByRole('dialog', { name: 'Clear model settings of 1 project?' });
    fireEvent.click(within(confirm).getByRole('button', { name: 'Clear' }));

    await waitFor(() => expect(within(confirm).getByRole('alert').textContent).toContain('locked'));
    expect(within(confirm).getByRole('button', { name: 'Cancel' }).hasAttribute('disabled')).toBe(
      false,
    );
    expect(within(confirm).getByRole('button', { name: 'Clear' }).hasAttribute('disabled')).toBe(
      false,
    );
    expect(screen.getByText('1 project has its own model settings')).toBeDefined();

    fireEvent.click(within(confirm).getByRole('button', { name: 'Clear' }));
    await waitFor(() => expect(screen.queryByText(/has its own model settings/)).toBeNull());
  });

  it('lists each project with its pins on Show and clears one at a time', async () => {
    await seed([PAYMENTS, LEDGER]);
    open();

    const show = screen.getByRole('button', { name: 'Show' });
    expect(show.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(show);

    expect(screen.getByRole('button', { name: 'Hide' }).getAttribute('aria-expanded')).toBe('true');
    const list = screen.getByRole('list', { name: 'Projects with their own model settings' });
    const items = within(list).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual([
      'payments-api: orchestrator Sonnet 5, summaries Sonnet 4.5, 6 rolesClear',
      'ledger-core: rebase Sonnet 5Clear',
    ]);

    fireEvent.click(
      within(list).getByRole('button', { name: 'Clear model settings of ledger-core' }),
    );
    fireEvent.click(
      within(
        screen.getByRole('dialog', { name: 'Clear model settings of ledger-core?' }),
      ).getByRole('button', { name: 'Clear' }),
    );

    await waitFor(() =>
      expect(screen.getByText('1 project has its own model settings')).toBeDefined(),
    );
    expect(
      (await getProjectById({ db: storySqlite(), id: LEDGER.id }))?.overrides.taskModels,
    ).toBeNull();
    expect(
      (await getProjectById({ db: storySqlite(), id: PAYMENTS.id }))?.overrides.roleModels,
    ).not.toBeNull();
  });
});
