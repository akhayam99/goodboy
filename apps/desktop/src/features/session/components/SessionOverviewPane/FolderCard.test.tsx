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
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { TEST_NOW, aProject, aSession, aWorkspace } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import { testTurn } from '../../../file-versions/testing/testTurn';
import { FolderCard } from './FolderCard';

const workspace = aWorkspace({ name: 'Acme notes', slug: 'acme-notes' });
const notes = aProject({
  workspaceId: workspace.id,
  name: 'acme-notes',
  rootPath: '/mock/home/Documents/acme-notes',
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
        runId: 'run-2',
        folderPath: notes.rootPath,
        changes: [{ relativePath: 'launch-memo.md' }, { relativePath: 'faq.md' }],
      }),
      testTurn({
        runId: 'run-1',
        folderPath: notes.rootPath,
        changes: [{ relativePath: 'launch-memo.md' }],
      }),
    ],
  });
  useAppStore.setState({
    workspaces: [workspace],
    projects: [notes],
    sessions: [session],
    sessionProjectMounts: { [session.id]: [] },
    folderPurpose: { [notes.id]: 'documents' },
  });
});

afterEach(cleanup);

describe('FolderCard', () => {
  it('says where agents write, what is saved, the changes so far and what stays read only', async () => {
    render(<FolderCard sessionId={session.id} />);

    const card = within(screen.getByRole('region', { name: 'acme-notes, where agents write' }));
    expect(card.getByText('Documents')).toBeDefined();
    expect(card.getByText('In the folder itself, one session at a time')).toBeDefined();
    expect(await card.findByText('2 files over 2 turns')).toBeDefined();
    expect(card.getByText('Word, PDF, Pages, Keynote, Numbers and Excel files')).toBeDefined();
    expect(card.getByText(notes.rootPath)).toBeDefined();
    expect(card.getByRole('button', { name: 'Open Changes' })).toBeDefined();
  });

  it('shows git found in a documents folder where the user looks, and Keep as documents answers it', async () => {
    useAppStore.setState({
      folderGitNotice: {
        [notes.id]: {
          kind: 'ask',
          foundAt: TEST_NOW,
          commitCount: 3,
          branch: 'main',
        },
      },
      keepFolderInPlace: async ({ projectId }) => {
        useAppStore.setState((state) => {
          const rest = { ...state.folderGitNotice };
          delete rest[projectId];
          return { folderGitNotice: rest };
        });
      },
    });
    render(<FolderCard sessionId={session.id} />);

    const card = within(screen.getByRole('region', { name: 'acme-notes, where agents write' }));
    expect(card.getByText('Goodboy found git in acme-notes.')).toBeDefined();
    fireEvent.click(card.getByRole('button', { name: 'Keep as documents' }));

    await waitFor(() => expect(card.queryByText('Goodboy found git in acme-notes.')).toBeNull());
  });

  it('stays out of a session that works on a branch', () => {
    useAppStore.setState({ projects: [] });

    const { container } = render(<FolderCard sessionId={session.id} />);

    expect(container.textContent).toBe('');
  });
});
