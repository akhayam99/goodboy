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
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { brandId, type IsoDateTime, type ProjectId } from '@goodboy/types';
import { insertProject, insertWorkspace, listProjectsForWorkspace } from '@goodboy/db';
import { aProject, aSession, aWorkspace, TEST_NOW } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  injectDbFault,
  openStorySqlite,
  resetStoryStore,
  storySqlite,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { WhereChip } from '.';

let useAppStore: StoryStore;

const WORKSPACE = aWorkspace({ name: 'Harborline' });

type ProjectParams = {
  readonly name: string;
  readonly isStarred?: boolean;
};

const projectOf = ({ name, isStarred = false }: ProjectParams) =>
  aProject({
    id: brandId<ProjectId>({ value: `project-${name}` }),
    workspaceId: WORKSPACE.id,
    name,
    kind: 'repo',
    rootPath: `/mock/Code/${name}`,
    ...(isStarred && { starredAt: TEST_NOW }),
  });

const NORTHWIND = projectOf({ name: 'northwind', isStarred: true });
const LEDGER = projectOf({ name: 'ledger-core' });
const NOTIFY = projectOf({ name: 'notify-relay' });
const PAYMENTS = projectOf({ name: 'payments-api' });
const ACME = projectOf({ name: 'acme-web' });
const PROJECTS = [NORTHWIND, LEDGER, NOTIFY, PAYMENTS, ACME];

type SessionParams = {
  readonly projectId: ProjectId;
  readonly updatedAt: string;
};

const sessionOn = ({ projectId, updatedAt }: SessionParams) =>
  aSession({
    workspaceId: WORKSPACE.id,
    activeProjectId: projectId,
    updatedAt: brandId<IsoDateTime>({ value: updatedAt }),
  });

const SESSIONS = [
  sessionOn({ projectId: NOTIFY.id, updatedAt: '2026-11-15T10:00:00.000Z' }),
  sessionOn({ projectId: PAYMENTS.id, updatedAt: '2026-11-16T09:00:00.000Z' }),
  sessionOn({ projectId: NORTHWIND.id, updatedAt: '2026-11-16T10:00:00.000Z' }),
];

const openPicker = () => fireEvent.click(screen.getByRole('combobox', { name: 'Projects' }));

const optionOrder = () =>
  screen.getAllByRole('option').map((option) => option.getAttribute('data-value'));

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  const db = await openStorySqlite();
  await insertWorkspace({ db, workspace: WORKSPACE });
  await Promise.all(PROJECTS.map((project) => insertProject({ db, project })));
  useAppStore.setState({
    workspaces: [WORKSPACE],
    currentWorkspaceId: WORKSPACE.id,
    projects: PROJECTS,
    sessions: SESSIONS,
  });
});

afterEach(cleanup);

describe('the Projects picker on New session', () => {
  it('lists starred first, then the folders the latest sessions used, then the rest', () => {
    render(
      <WhereChip
        workspaceId={WORKSPACE.id}
        match={{ projectId: ACME.id, reason: 'from GitLab repo acme/acme-web' }}
        isDisabled={false}
      />,
    );
    openPicker();

    expect(optionOrder()).toEqual([NORTHWIND.id, ACME.id, PAYMENTS.id, NOTIFY.id, LEDGER.id]);
    screen.getByText('Starred');
    screen.getByText('Recent');
    screen.getByText('All projects');
    screen.getByText('From GitLab repo acme/acme-web');
    expect(screen.queryByText('Star a project to keep it on top')).toBeNull();
  });

  it('stars a folder after the save and a second window reads it', async () => {
    render(<WhereChip workspaceId={WORKSPACE.id} match={null} isDisabled={false} />);
    openPicker();

    fireEvent.click(screen.getByRole('button', { name: 'Star ledger-core' }));

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Unstar ledger-core' }).getAttribute('aria-pressed'),
      ).toBe('true'),
    );
    expect(optionOrder().slice(0, 2)).toEqual([LEDGER.id, NORTHWIND.id]);
    const secondWindow = await listProjectsForWorkspace({
      db: storySqlite(),
      workspaceId: WORKSPACE.id,
    });
    expect(secondWindow.find((project) => project.id === LEDGER.id)?.starredAt).toBeDefined();
  });

  it('keeps the star as it was and says why when the save fails', async () => {
    injectDbFault({ match: /UPDATE projects SET starred_at/, message: 'database is locked' });
    render(<WhereChip workspaceId={WORKSPACE.id} match={null} isDisabled={false} />);
    openPicker();

    fireEvent.click(screen.getByRole('button', { name: 'Star ledger-core' }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      "Couldn't star ledger-core: database is locked",
    );
    expect(
      screen.getByRole('button', { name: 'Star ledger-core' }).getAttribute('aria-pressed'),
    ).toBe('false');
    expect(
      useAppStore.getState().projects.find((project) => project.id === LEDGER.id)?.starredAt,
    ).toBeUndefined();
  });

  it('shows one quiet hint when nothing is starred', () => {
    useAppStore.setState({
      projects: PROJECTS.map((project) => projectOf({ name: project.name })),
    });
    render(<WhereChip workspaceId={WORKSPACE.id} match={null} isDisabled={false} />);
    openPicker();

    expect(screen.queryByText('Starred')).toBeNull();
    expect(screen.getAllByText('Star a project to keep it on top')).toHaveLength(1);
  });
});
