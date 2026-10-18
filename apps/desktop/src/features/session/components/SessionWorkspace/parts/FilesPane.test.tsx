// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../../store/storyHarness')).dbModuleMock(),
);
vi.mock('../../../../../shared/lib/db', async () =>
  (await import('../../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { aProject, aSession, aWorkspace } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { testTurn } from '../../../../file-versions/testing/testTurn';
import { FilesPane } from './FilesPane';

const workspace = aWorkspace({ name: 'Acme notes', slug: 'acme-notes' });
const notes = aProject({
  workspaceId: workspace.id,
  name: 'acme-notes',
  rootPath: '/mock/Documents/acme-notes',
  kind: 'folder',
});
const session = aSession({ workspaceId: workspace.id, goal: 'Tighten the launch memo' });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({
    file_versions_folder_list_turns: [
      testTurn({
        runId: 'run-1',
        folderPath: notes.rootPath,
        changes: [{ relativePath: 'launch-memo.md' }],
      }),
    ],
    file_versions_folder_read: { kind: 'text', text: 'Acme Notes\n', sizeBytes: 11 },
    file_versions_folder_size: {
      folderPath: notes.rootPath,
      isReady: true,
      fileCount: 86,
      keptBytes: 1_024,
      versionBytes: 512,
      versionCount: 1,
      capBytes: 1_073_741_824,
    },
  });
  useAppStore.setState({
    workspaces: [workspace],
    projects: [notes],
    sessions: [session],
  });
});

afterEach(cleanup);

describe('FilesPane', () => {
  it('opens Changes for a session that edits its folder in place', async () => {
    useAppStore.setState({ sessionProjectMounts: { [session.id]: [] } });

    render(<FilesPane sessionId={session.id} sessionDir={null} onClose={() => undefined} />);

    expect(await screen.findByRole('button', { name: 'launch-memo.md, turn 1' })).toBeDefined();
    expect(storySpies.tauriInvoke).toHaveBeenCalledWith('file_versions_folder_list_turns', {
      args: { folderPath: notes.rootPath, sessionId: session.id },
    });
  });

  it('keeps Changes and the saved turns once the folder is tracked with git', async () => {
    useAppStore.setState({
      projects: [{ ...notes, kind: 'repo' }],
      sessionProjectMounts: { [session.id]: [] },
    });

    render(<FilesPane sessionId={session.id} sessionDir={null} onClose={() => undefined} />);

    expect(await screen.findByRole('button', { name: 'launch-memo.md, turn 1' })).toBeDefined();
  });

  it('explains itself when an older session folder is missing', () => {
    useAppStore.setState({ projects: [] });

    render(<FilesPane sessionId={session.id} sessionDir={null} onClose={() => undefined} />);

    expect(screen.getByText('Session folder missing')).toBeDefined();
  });
});
