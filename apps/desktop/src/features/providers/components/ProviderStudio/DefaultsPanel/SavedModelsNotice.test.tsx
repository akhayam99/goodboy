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
import { getSetting, insertProject, insertWorkspace, setSetting } from '@goodboy/db';
import type { Project, WorkspaceId } from '@goodboy/types';
import { EMPTY_OVERRIDES, aProject } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  buildStoryWorkspace,
  importStore,
  openStorySqlite,
  resetStoryStore,
  storySqlite,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { SavedModelsNotice } from './SavedModelsNotice';

const WORKSPACE_ID = 'workspace-harborline' as WorkspaceId;
const OTHER_WORKSPACE_ID = 'workspace-northwind' as WorkspaceId;

const PAYMENTS = aProject({
  id: 'project-payments-api' as Project['id'],
  workspaceId: WORKSPACE_ID,
  name: 'payments-api',
  rootPath: '/tmp/payments-api',
});

const LEDGER = aProject({
  id: 'project-ledger-core' as Project['id'],
  workspaceId: WORKSPACE_ID,
  name: 'ledger-core',
  rootPath: '/tmp/ledger-core',
});

const PAYMENTS_SAVED = {
  taskModels: {
    workflow_orchestrator: { providerId: 'anthropic', model: 'claude-sonnet-5' },
    summarizer: { providerId: 'anthropic', model: 'claude-sonnet-4-5' },
  },
  roleModels: {
    planner: { providerId: 'anthropic', model: 'claude-opus-5-5', effort: 'high' },
    reviewer: { providerId: 'anthropic', model: 'claude-sonnet-5', effort: 'medium' },
  },
};

const LEDGER_SAVED = {
  taskModels: { rebase: { providerId: 'anthropic', model: 'claude-sonnet-5' } },
  roleModels: null,
};

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
  useAppStore.setState({
    workspaceOverrides: {
      [WORKSPACE_ID]: {
        ...EMPTY_OVERRIDES,
        roleModels: {
          planner: { providerId: 'codex', model: 'gpt-6.1-sol', effort: 'medium' },
          scout: { providerId: 'codex', model: 'gpt-6.1-sol', effort: 'low' },
        },
      },
    },
  });
});

afterEach(cleanup);

type SeedParams = {
  readonly projects: ReadonlyArray<Project>;
  readonly saved: Readonly<Record<string, unknown>>;
};

const seed = async ({ projects, saved }: SeedParams) => {
  const db = storySqlite();
  for (const project of projects) {
    await insertProject({ db, project });
  }
  for (const [projectId, value] of Object.entries(saved)) {
    await setSetting(db, `legacy.projectModels.${projectId}`, JSON.stringify(value));
  }
  useAppStore.setState({ projects });
};

const open = () => render(<SavedModelsNotice workspaceId={WORKSPACE_ID} />);

describe('SavedModelsNotice', () => {
  it('stays away when no project has saved model settings', async () => {
    await seed({ projects: [PAYMENTS], saved: {} });

    const { container } = open();

    await waitFor(() => expect(useAppStore.getState().savedProjectModels).toEqual({}));
    expect(container.textContent).toBe('');
  });

  it('ignores a project of another workspace', async () => {
    await seed({
      projects: [{ ...PAYMENTS, workspaceId: OTHER_WORKSPACE_ID }, LEDGER],
      saved: { [PAYMENTS.id]: PAYMENTS_SAVED },
    });

    const { container } = open();

    await waitFor(() =>
      expect(Object.keys(useAppStore.getState().savedProjectModels)).toEqual([PAYMENTS.id]),
    );
    expect(container.textContent).toBe('');
  });

  it('ignores a saved value that is not model settings', async () => {
    await seed({ projects: [PAYMENTS], saved: { [PAYMENTS.id]: { taskModels: 'x' } } });

    const { container } = open();

    await waitFor(() => expect(useAppStore.getState().savedProjectModels).toEqual({}));
    expect(container.textContent).toBe('');
  });

  it('says the saved settings no longer apply and counts the projects', async () => {
    await seed({
      projects: [PAYMENTS, LEDGER],
      saved: { [PAYMENTS.id]: PAYMENTS_SAVED, [LEDGER.id]: LEDGER_SAVED },
    });

    open();

    expect(await screen.findByText('Model settings 2 projects had are saved')).toBeDefined();
    expect(screen.getByText('They no longer apply.')).toBeDefined();
  });

  it('counts one project in the singular', async () => {
    await seed({ projects: [PAYMENTS], saved: { [PAYMENTS.id]: PAYMENTS_SAVED } });

    open();

    expect(await screen.findByText('Model settings 1 project had are saved')).toBeDefined();
  });

  it('lists each project with what it had on Show', async () => {
    await seed({
      projects: [PAYMENTS, LEDGER],
      saved: { [PAYMENTS.id]: PAYMENTS_SAVED, [LEDGER.id]: LEDGER_SAVED },
    });
    open();

    const show = await screen.findByRole('button', { name: 'Show' });
    expect(show.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(show);

    expect(screen.getByRole('button', { name: 'Hide' }).getAttribute('aria-expanded')).toBe('true');
    const list = screen.getByRole('list', { name: 'Projects with saved model settings' });
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      'payments-api: orchestrator Sonnet 5, summaries Sonnet 4.5, 2 rolesApply to this pageDiscard',
      'ledger-core: history rewriter Sonnet 5Apply to this pageDiscard',
    ]);
  });

  it('keeps everything on Cancel and merges into the page on Apply, saved values winning', async () => {
    await seed({ projects: [PAYMENTS], saved: { [PAYMENTS.id]: PAYMENTS_SAVED } });
    open();
    fireEvent.click(await screen.findByRole('button', { name: 'Show' }));

    fireEvent.click(
      screen.getByRole('button', { name: 'Apply the saved settings of payments-api to this page' }),
    );
    const confirm = screen.getByRole('dialog', {
      name: 'Apply the saved settings of payments-api to this page?',
    });
    expect(within(confirm).getByText(/replace the pins this page has/)).toBeDefined();
    fireEvent.click(within(confirm).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(await getSetting(storySqlite(), `legacy.projectModels.${PAYMENTS.id}`)).not.toBeNull();
    expect(useAppStore.getState().workspaceOverrides[WORKSPACE_ID]?.taskModels ?? null).toBeNull();

    fireEvent.click(
      screen.getByRole('button', { name: 'Apply the saved settings of payments-api to this page' }),
    );
    fireEvent.click(
      within(
        screen.getByRole('dialog', {
          name: 'Apply the saved settings of payments-api to this page?',
        }),
      ).getByRole('button', { name: 'Apply' }),
    );

    await waitFor(() => expect(screen.queryByText(/had are saved/)).toBeNull());
    const overrides = useAppStore.getState().workspaceOverrides[WORKSPACE_ID];
    expect(overrides?.taskModels).toEqual(PAYMENTS_SAVED.taskModels);
    expect(overrides?.roleModels).toMatchObject({
      planner: { providerId: 'anthropic', model: 'claude-opus-5-5' },
      reviewer: { providerId: 'anthropic', model: 'claude-sonnet-5' },
      scout: { providerId: 'codex', model: 'gpt-6.1-sol' },
    });
    expect(await getSetting(storySqlite(), `legacy.projectModels.${PAYMENTS.id}`)).toBeNull();
  });

  it('keeps the saved value and shows the reason when the write to the page fails', async () => {
    await seed({ projects: [PAYMENTS], saved: { [PAYMENTS.id]: PAYMENTS_SAVED } });
    stubStoryInvoke({
      set_workspace_overrides: () => {
        throw new Error('settings file is locked');
      },
    });
    open();
    fireEvent.click(await screen.findByRole('button', { name: 'Show' }));

    fireEvent.click(
      screen.getByRole('button', { name: 'Apply the saved settings of payments-api to this page' }),
    );
    const confirm = screen.getByRole('dialog', {
      name: 'Apply the saved settings of payments-api to this page?',
    });
    fireEvent.click(within(confirm).getByRole('button', { name: 'Apply' }));

    await waitFor(() => expect(within(confirm).getByRole('alert').textContent).toContain('locked'));
    expect(within(confirm).getByRole('button', { name: 'Apply' }).hasAttribute('disabled')).toBe(
      false,
    );
    expect(await getSetting(storySqlite(), `legacy.projectModels.${PAYMENTS.id}`)).not.toBeNull();
    expect(screen.getByText('Model settings 1 project had are saved')).toBeDefined();
    expect(useAppStore.getState().workspaceOverrides[WORKSPACE_ID]?.taskModels ?? null).toBeNull();
  });

  it('discards one project at a time behind an anchored confirm', async () => {
    await seed({
      projects: [PAYMENTS, LEDGER],
      saved: { [PAYMENTS.id]: PAYMENTS_SAVED, [LEDGER.id]: LEDGER_SAVED },
    });
    open();
    fireEvent.click(await screen.findByRole('button', { name: 'Show' }));

    fireEvent.click(
      screen.getByRole('button', { name: 'Discard the saved settings of ledger-core' }),
    );
    fireEvent.click(
      within(
        screen.getByRole('dialog', { name: 'Discard the saved settings of ledger-core?' }),
      ).getByRole('button', { name: 'Discard' }),
    );

    await waitFor(() =>
      expect(screen.getByText('Model settings 1 project had are saved')).toBeDefined(),
    );
    expect(await getSetting(storySqlite(), `legacy.projectModels.${LEDGER.id}`)).toBeNull();
    expect(await getSetting(storySqlite(), `legacy.projectModels.${PAYMENTS.id}`)).not.toBeNull();
    expect(useAppStore.getState().workspaceOverrides[WORKSPACE_ID]?.taskModels ?? null).toBeNull();
  });

  it('hides the notice once the last saved project is discarded', async () => {
    await seed({ projects: [LEDGER], saved: { [LEDGER.id]: LEDGER_SAVED } });
    const { container } = open();
    fireEvent.click(await screen.findByRole('button', { name: 'Show' }));

    fireEvent.click(
      screen.getByRole('button', { name: 'Discard the saved settings of ledger-core' }),
    );
    fireEvent.click(
      within(
        screen.getByRole('dialog', { name: 'Discard the saved settings of ledger-core?' }),
      ).getByRole('button', { name: 'Discard' }),
    );

    await waitFor(() => expect(container.textContent).toBe(''));
  });
});
