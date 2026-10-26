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
vi.mock('@tauri-apps/api/path', () => ({ homeDir: vi.fn(async () => '/mock') }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { brandId, type ProjectId } from '@goodboy/types';
import { insertProject, insertWorkspace } from '@goodboy/db';
import { aProject, aWorkspace } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  injectDbFault,
  openStorySqlite,
  resetStoryStore,
  rowsOf,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { FolderFacesBand } from './index';

let useAppStore: StoryStore;

const WORKSPACE = aWorkspace({ name: 'Acme notes' });
const NOTES_ID = brandId<ProjectId>({ value: 'project-acme-notes' });
const NOTES = aProject({
  id: NOTES_ID,
  workspaceId: WORKSPACE.id,
  name: 'acme-notes',
  kind: 'folder',
  rootPath: '/mock/Documents/acme-notes',
});
const LEDGER = aProject({
  workspaceId: WORKSPACE.id,
  name: 'ledger-core',
  kind: 'repo',
  rootPath: '/mock/Code/ledger-core',
});
const MB = 1024 * 1024;

type SizeArgs = {
  readonly args: { readonly folderPath: string };
};

const sizeOf = ({ args }: SizeArgs) => ({
  folderPath: args.folderPath,
  isReady: true,
  fileCount: 98,
  keptBytes: 42 * MB,
  versionBytes: 18 * MB,
  versionCount: 12,
  capBytes: 1024 * MB,
});

const storedFace = async (): Promise<string | null> =>
  (
    await rowsOf<{ readonly value: string }>({
      sql: 'SELECT value FROM project_values WHERE project_id = ? AND key = ?',
      params: [NOTES_ID, 'folder.purpose'],
    })
  )[0]?.value ?? null;

const faces = () => within(screen.getByRole('tablist', { name: 'What acme-notes is for' }));

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  const db = await openStorySqlite();
  await insertWorkspace({ db, workspace: WORKSPACE });
  await insertProject({ db, project: NOTES });
  await insertProject({ db, project: LEDGER });
  stubStoryInvoke({ file_versions_folder_size: sizeOf });
  useAppStore.setState({ workspaces: [WORKSPACE], projects: [NOTES, LEDGER] });
  await useAppStore.getState().setFolderPurpose({ projectId: NOTES_ID, purpose: 'documents' });
});

afterEach(cleanup);

describe('the plain folders band in Folders settings', () => {
  it('lists each plain folder with its face, never a repository', async () => {
    render(<FolderFacesBand workspaceId={WORKSPACE.id} />);

    expect(await screen.findByRole('group', { name: 'acme-notes, what it is for' })).toBeDefined();
    expect(screen.queryByRole('group', { name: 'ledger-core, what it is for' })).toBeNull();
    expect(faces().getByRole('tab', { name: 'Documents' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(screen.getByText(/leave Word, PDF, Pages and Keynote files alone/)).toBeDefined();
  });

  it('switches the face from the next turn on and saves the row', async () => {
    render(<FolderFacesBand workspaceId={WORKSPACE.id} />);

    fireEvent.click(faces().getByRole('tab', { name: 'Code project' }));

    await waitFor(() =>
      expect(faces().getByRole('tab', { name: 'Code project' }).getAttribute('aria-selected')).toBe(
        'true',
      ),
    );
    expect(useAppStore.getState().folderPurpose[NOTES_ID]).toBe('code');
    expect(await storedFace()).toBe('code');
    expect(screen.getByText(/Track it with git for branches and pull requests/)).toBeDefined();
  });

  it('keeps the old face with the error beside it when the write fails', async () => {
    injectDbFault({ match: /UPDATE project_values/, message: 'disk I/O error' });
    render(<FolderFacesBand workspaceId={WORKSPACE.id} />);

    fireEvent.click(faces().getByRole('tab', { name: 'Code project' }));

    expect((await screen.findByRole('alert')).textContent).toContain('disk I/O error');
    expect(faces().getByRole('tab', { name: 'Documents' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(await storedFace()).toBe('documents');
  });

  it('shows the size of saved versions and leads to Storage', async () => {
    const opened = vi.fn();
    window.addEventListener('goodboy:open-settings', opened);
    render(<FolderFacesBand workspaceId={WORKSPACE.id} />);

    expect(
      await screen.findByText(
        'Saved versions for acme-notes: 18 MB of 1.0 GB allowed, kept until 30 days after each session ends',
      ),
    ).toBeDefined();
    expect(
      screen
        .getByRole('meter', { name: 'Saved versions of acme-notes' })
        .getAttribute('aria-valuenow'),
    ).toBe(String(18 * MB));
    fireEvent.click(screen.getByRole('button', { name: 'Review in Storage' }));

    expect(opened).toHaveBeenCalledOnce();
    expect(useAppStore.getState().storageScope).toEqual({ kind: 'workspace', id: WORKSPACE.id });
    window.removeEventListener('goodboy:open-settings', opened);
  });

  it('says a failed first copy and Retry starts it again', async () => {
    useAppStore.setState({
      folderVersionsStatus: { [NOTES_ID]: { kind: 'failed', message: 'disk full' } },
    });
    stubStoryInvoke({
      file_versions_folder_size: sizeOf,
      file_versions_folder_prepare: {
        folderPath: NOTES.rootPath,
        isReady: true,
        isTurnOpen: false,
        fileCount: 98,
        keptBytes: 42 * MB,
        skipped: [],
        method: 'clone',
      },
    });
    render(<FolderFacesBand workspaceId={WORKSPACE.id} />);

    expect(screen.getByRole('alert').textContent).toContain(
      "Saved versions couldn't start: disk full",
    );
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() =>
      expect(useAppStore.getState().folderVersionsStatus[NOTES_ID]?.kind).toBe('ready'),
    );
    expect(await screen.findByText(/Saved versions for acme-notes: 18 MB/)).toBeDefined();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
