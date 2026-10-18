// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { aProject, aSession, aWorkspace } from '@goodboy/types/testing';
import { brandId, type ProviderRunId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import type { FolderRestoreResult, FolderTurnManifest } from '../../../file-versions/fileVersions';
import { folderChangeKey } from '../../../file-versions/folderChangeKey';
import { testTurn } from '../../../file-versions/testing/testTurn';
import { TurnChangesCard } from './index';

const NOTES_PATH = '/mock/Documents/acme-notes';
const RUN_ID = brandId<ProviderRunId>({ value: 'run-memo' });

const workspace = aWorkspace({ name: 'Acme notes', slug: 'acme-notes' });
const notes = aProject({
  workspaceId: workspace.id,
  name: 'acme-notes',
  rootPath: NOTES_PATH,
  kind: 'folder',
});
const session = aSession({ workspaceId: workspace.id, goal: 'Tighten the launch memo' });

type RestoreArgs = Readonly<{
  args: Readonly<{ runId: string; restoreRunId: string }>;
}>;

type World = { turns: Array<FolderTurnManifest>; finalized: number };

const world: World = { turns: [], finalized: 0 };

const restore = ({ args }: RestoreArgs): FolderRestoreResult => {
  const target = world.turns.find((turn) => turn.runId === args.runId);
  const manifest = testTurn({
    runId: args.restoreRunId,
    kind: 'restore',
    restoresRunId: args.runId,
    finishedAtMs: Date.now(),
    folderPath: NOTES_PATH,
    changes: (target?.changes ?? []).map((change) => ({ relativePath: change.relativePath })),
  });
  world.turns = [manifest, ...world.turns];
  return { status: 'restored', changedSince: [], turn: manifest, kept: [] };
};

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  world.turns = [
    testTurn({
      runId: RUN_ID,
      folderPath: NOTES_PATH,
      changes: [
        { relativePath: 'launch-memo.md' },
        { relativePath: 'summary.md', change: 'added' },
      ],
    }),
  ];
  world.finalized = 0;
  stubStoryInvoke({
    file_versions_folder_list_turns: () => world.turns,
    file_versions_folder_read: { kind: 'text', text: 'Acme Notes\n', sizeBytes: 11 },
    file_versions_folder_restore: restore,
    file_versions_folder_finalize: () => {
      world.finalized += 1;
      return { sessionId: session.id, runId: RUN_ID, turn: world.turns[0] ?? null, kept: [] };
    },
  });
  useAppStore.setState({
    workspaces: [workspace],
    projects: [notes],
    sessions: [session],
    sessionProjectMounts: { [session.id]: [] },
  });
});

afterEach(cleanup);

describe('TurnChangesCard', () => {
  it('names what the turn changed in the folder and opens Changes on the first file', async () => {
    render(<TurnChangesCard sessionId={session.id} runId={RUN_ID} />);

    expect(await screen.findByText('Changed 2 files in acme-notes')).toBeDefined();
    expect(screen.getByText('new file')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Review changes' }));

    expect(useAppStore.getState().sessionFileVersionSelectedPath[session.id]).toBe(
      folderChangeKey({ folderPath: NOTES_PATH, runId: RUN_ID, relativePath: 'launch-memo.md' }),
    );
  });

  it('restores the whole turn in place and undoes it', async () => {
    render(<TurnChangesCard sessionId={session.id} runId={RUN_ID} />);

    fireEvent.click(await screen.findByRole('button', { name: /Restore turn/ }));

    expect(await screen.findByText('Restored turn 1.')).toBeDefined();
    await waitFor(() => expect(screen.getAllByText('restored')).toHaveLength(2));
    fireEvent.click(screen.getByRole('button', { name: 'Undo restore of turn 1' }));
    await waitFor(() => expect(screen.queryAllByText('restored')).toHaveLength(0));
  });

  it('says when the changes of the turn could not be saved, and retries', async () => {
    useAppStore.setState({
      folderCaptureFailures: {
        [RUN_ID]: { sessionId: session.id, folderPaths: [NOTES_PATH], message: 'disk is full' },
      },
    });
    render(<TurnChangesCard sessionId={session.id} runId={RUN_ID} />);

    expect(screen.getByText("Changes from this turn couldn't be saved")).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(world.finalized).toBe(1));
    expect(await screen.findByText('Changed 2 files in acme-notes')).toBeDefined();
  });
});
