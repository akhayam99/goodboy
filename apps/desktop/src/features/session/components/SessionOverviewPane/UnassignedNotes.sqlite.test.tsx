// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).sqliteDbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { insertSession, insertWorkspace } from '@goodboy/db';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import {
  buildStoryWorkspace,
  importStore,
  openStorySqlite,
  resetStoryStore,
  rowsOf,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../../../store/storyHarness';
import { pressShortcut } from '../../../../__tests__/helpers/pressKey';
import { ToastProvider } from '../../../../shared/components/Toast';
import { UndoToastBridge } from '../../../../app/components/UndoToastBridge';
import { UnassignedNotes } from './UnassignedNotes';

const WORKSPACE_ID = 'workspace-harborline' as WorkspaceId;
const SESSION_ID = 'session-ledger-export' as SessionId;

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  const db = await openStorySqlite();
  await insertWorkspace({
    db,
    workspace: buildStoryWorkspace({ id: WORKSPACE_ID, name: 'Harborline' }),
  });
  await insertSession(db, aSession({ id: SESSION_ID, workspaceId: WORKSPACE_ID }));
  await useAppStore
    .getState()
    .addDiffComment(SESSION_ID, 'src/ledger/postings.ts', 'Cast the ledger id', {
      side: 'new',
      lineNumber: 42,
    });
  await useAppStore
    .getState()
    .addDiffComment(SESSION_ID, 'src/ledger/export.ts', 'Rename PAGE_SIZE');
});

afterEach(cleanup);

const storedIds = async () =>
  (await rowsOf<{ id: string }>({ sql: 'SELECT id FROM diff_comments ORDER BY created_at, id' }))
    .map((row) => row.id)
    .sort();

const renderNotes = () =>
  render(
    <ToastProvider>
      <UndoToastBridge />
      <UnassignedNotes sessionId={SESSION_ID} />
    </ToastProvider>,
  );

describe('UnassignedNotes on sqlite', () => {
  it('discards one note with a toast, and Undo brings back the same note', async () => {
    const before = await storedIds();
    renderNotes();

    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Note actions' })[0]!);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Discard' }));
    });

    expect(await storedIds()).toHaveLength(1);
    expect(screen.queryByText('Cast the ledger id')).toBeNull();
    screen.getByText('Note discarded');
    expect(screen.queryByRole('dialog')).toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    });

    expect(await storedIds()).toEqual(before);
    await waitFor(() => screen.getByText('Cast the ledger id'));
  });

  it('brings the note back with Cmd+Z', async () => {
    const before = await storedIds();
    renderNotes();
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Note actions' })[0]!);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Discard' }));
    });

    await act(async () => {
      pressShortcut({ id: 'app.undo' });
    });

    expect(await storedIds()).toEqual(before);
    await waitFor(() => screen.getByText('Cast the ledger id'));
  });

  it('discards every note with Discard all and Undo restores them together', async () => {
    const before = await storedIds();
    renderNotes();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Discard all' }));
    });

    expect(await storedIds()).toEqual([]);
    expect(screen.queryByRole('region', { name: 'Unassigned notes' })).toBeNull();
    screen.getByText('2 notes discarded');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    });

    expect(await storedIds()).toEqual(before);
    await waitFor(() => screen.getByText('Rename PAGE_SIZE'));
  });
});
