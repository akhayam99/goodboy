// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn(async () => null) }));
vi.mock('@tauri-apps/api/path', () => ({ homeDir: vi.fn(async () => '/mock') }));

import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GitRepoCheck } from '@goodboy/types';
import { aFolderSignals } from '@goodboy/types/testing';
import {
  importStore,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
  storySpies,
  stubStoryInvoke,
} from '../../../../store/storyHarness';
import { NewWorkspaceForm } from '../index';

const CODE = '/mock/Code';
const WORK = '/mock/work';
const DOCUMENTS = '/mock/Documents';

type PathParams = {
  readonly path: string;
};

const plainAt = ({ path }: PathParams): GitRepoCheck => ({
  isRepo: false,
  rootPath: null,
  resolvedPath: path,
  defaultBranch: null,
  error: 'not a git repository',
  errorKind: 'not_a_repository',
});

const missingAt = ({ path }: PathParams): GitRepoCheck => ({
  isRepo: false,
  rootPath: null,
  resolvedPath: null,
  defaultBranch: null,
  error: `path does not exist: ${path}`,
  errorKind: 'not_found',
});

const EXISTING: ReadonlySet<string> = new Set([CODE, WORK]);

const CHILDREN: Readonly<Record<string, ReadonlyArray<unknown>>> = {
  [CODE]: [
    { name: 'ledger-core', path: `${CODE}/ledger-core`, defaultBranch: 'main' },
    { name: 'notify-relay', path: `${CODE}/notify-relay`, defaultBranch: 'main' },
  ],
  [WORK]: [{ name: 'payments-api', path: `${WORK}/payments-api`, defaultBranch: 'main' }],
};

const pathOf = (args: unknown): string =>
  typeof args === 'object' && args !== null && 'path' in args ? String(args.path) : '';

const commandsCalled = ({ command }: { readonly command: string }): ReadonlyArray<string> =>
  storySpies.tauriInvoke.mock.calls
    .filter(([name]) => name === command)
    .map(([, args]) => pathOf(args));

const likely = () => within(screen.getByRole('list', { name: 'Likely folders' }));

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({
    validate_git_repo: (args: unknown) =>
      EXISTING.has(pathOf(args))
        ? plainAt({ path: pathOf(args) })
        : missingAt({ path: pathOf(args) }),
    scan_child_repos: (args: unknown) => CHILDREN[pathOf(args)] ?? [],
    repo_identity: { rootCommits: [], remoteUrl: null },
    read_folder_signals: (args: unknown) => aFolderSignals({ path: pathOf(args) }),
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const renderFirstRun = () => render(<NewWorkspaceForm mode="first-run" />);

describe('likely folders on the Workspace step', () => {
  it('lists the folders that exist on this Mac and none that do not', async () => {
    renderFirstRun();

    await screen.findByRole('list', { name: 'Likely folders' });
    likely().getByRole('checkbox', { name: 'Look in ~/Code' });
    likely().getByRole('checkbox', { name: 'Look in ~/work' });
    expect(likely().queryByRole('checkbox', { name: 'Look in ~/dev' })).toBeNull();
    screen.getByRole('button', { name: /Choose folder/ });
  });

  it('reads nothing when you tick, and reads the ticked folders when you press the Look in button', async () => {
    renderFirstRun();
    await screen.findByRole('list', { name: 'Likely folders' });

    fireEvent.click(likely().getByRole('checkbox', { name: 'Look in ~/Code' }));
    fireEvent.click(likely().getByRole('checkbox', { name: 'Look in ~/work' }));

    expect(commandsCalled({ command: 'scan_child_repos' })).toEqual([]);
    expect(screen.queryByRole('button', { name: /Choose folder/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Look in 2 folders' }));

    const folders = within(await screen.findByRole('list', { name: 'Folders' }));
    folders.getByText('ledger-core');
    folders.getByText('notify-relay');
    folders.getByText('payments-api');
    expect([...commandsCalled({ command: 'scan_child_repos' })].sort()).toEqual([CODE, WORK]);
  });

  it('takes a tick back before the scan', async () => {
    renderFirstRun();
    await screen.findByRole('list', { name: 'Likely folders' });

    fireEvent.click(likely().getByRole('checkbox', { name: 'Look in ~/Code' }));
    fireEvent.click(likely().getByRole('checkbox', { name: 'Look in ~/Code' }));

    screen.getByRole('button', { name: /Choose folder/ });
    expect(commandsCalled({ command: 'scan_child_repos' })).toEqual([]);
  });

  it('draws no list on the New workspace page, which keeps the drop area alone', async () => {
    render(<NewWorkspaceForm mode="new" />);

    await act(async () => undefined);
    expect(commandsCalled({ command: 'validate_git_repo' })).toEqual([]);
    expect(screen.queryByRole('list', { name: 'Likely folders' })).toBeNull();
  });

  it('offers Documents on macOS without reading it', async () => {
    vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Macintosh)');
    renderFirstRun();

    await screen.findByRole('list', { name: 'Likely folders' });
    likely().getByRole('checkbox', { name: 'Look in ~/Documents' });
    expect(commandsCalled({ command: 'validate_git_repo' })).not.toContain(DOCUMENTS);
    expect(commandsCalled({ command: 'scan_child_repos' })).toEqual([]);
  });

  it('offers no Documents row off macOS', async () => {
    vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (X11; Linux)');
    renderFirstRun();

    await screen.findByRole('list', { name: 'Likely folders' });
    expect(likely().queryByRole('checkbox', { name: 'Look in ~/Documents' })).toBeNull();
  });
});
