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
import { cleanup, render, screen, within } from '@testing-library/react';
import { aProject, aWorkspace } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import { SavedVersionsSection } from './SavedVersionsSection';

let useAppStore: StoryStore;

const MB = 1024 * 1024;
const ACME = aWorkspace({ name: 'Acme notes', slug: 'acme-notes' });
const HARBORLINE = aWorkspace({ name: 'Harborline', slug: 'harborline' });
const NOTES = aProject({
  workspaceId: ACME.id,
  name: 'acme-notes',
  kind: 'folder',
  rootPath: '/mock/Documents/acme-notes',
});
const RUNBOOKS = aProject({
  workspaceId: HARBORLINE.id,
  name: 'runbooks',
  kind: 'folder',
  rootPath: '/mock/Code/harborline/runbooks',
});
const LEDGER = aProject({
  workspaceId: HARBORLINE.id,
  name: 'ledger-core',
  kind: 'repo',
  rootPath: '/mock/Code/harborline/ledger-core',
});

const USED: Readonly<Record<string, number>> = {
  [NOTES.rootPath]: 18 * MB,
  [RUNBOOKS.rootPath]: 6 * MB,
};

type SizeArgs = {
  readonly args: { readonly folderPath: string };
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({
    file_versions_folder_size: ({ args }: SizeArgs) => ({
      folderPath: args.folderPath,
      isReady: true,
      fileCount: 40,
      keptBytes: 42 * MB,
      versionBytes: USED[args.folderPath] ?? 0,
      versionCount: 12,
      capBytes: 1024 * MB,
    }),
  });
  useAppStore.setState({
    workspaces: [ACME, HARBORLINE],
    projects: [NOTES, RUNBOOKS, LEDGER],
  });
});

afterEach(cleanup);

describe('saved versions in Storage', () => {
  it('groups saved versions per plain folder of every workspace, repositories left out', async () => {
    render(<SavedVersionsSection scope={{ kind: 'all' }} />);

    const section = within(screen.getByRole('region', { name: 'Saved versions' }));
    expect(await section.findByText('18 MB of 1.0 GB')).toBeDefined();
    expect(await section.findByText('6.0 MB of 1.0 GB')).toBeDefined();
    expect(section.getByText('Saved versions · 24 MB')).toBeDefined();
    expect(section.queryByText('ledger-core')).toBeNull();
  });

  it('keeps to the folders of the workspace in scope', async () => {
    render(<SavedVersionsSection scope={{ kind: 'workspace', id: ACME.id }} />);

    const section = within(screen.getByRole('region', { name: 'Saved versions' }));
    expect(await section.findByText('18 MB of 1.0 GB')).toBeDefined();
    expect(section.queryByText('runbooks')).toBeNull();
  });

  it('is absent where no plain folder is in scope', () => {
    const { container } = render(
      <SavedVersionsSection scope={{ kind: 'workspace', id: HARBORLINE.id }} />,
    );

    expect(within(container).queryByText('runbooks')).not.toBeNull();
    cleanup();
    useAppStore.setState({ projects: [LEDGER] });
    const empty = render(<SavedVersionsSection scope={{ kind: 'all' }} />);
    expect(empty.container.textContent).toBe('');
  });
});
