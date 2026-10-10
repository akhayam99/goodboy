// @vitest-environment happy-dom

const h = vi.hoisted(() => {
  const scratch: { current: string | Error } = { current: '/scratch/session-payout-export' };
  return {
    invoke: vi.fn<(command: string, args?: Record<string, unknown>) => Promise<unknown>>(),
    lists: new Map<string, unknown>(),
    scratch,
  };
});

vi.mock('@tauri-apps/api/core', () => ({ invoke: h.invoke }));
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async () => () => undefined),
  emit: vi.fn(async () => undefined),
}));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type {
  MountId,
  Project,
  SessionId,
  SessionMountView,
  SessionProjectMount,
} from '@goodboy/types';
import { aProject } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../store/storyHarness';
import type { StoryStore } from '../../../../store/storyHarness';
import {
  FIXTURE_NOW,
  SESSION,
  WORKSPACE,
  mountFixture,
  sessionFixture,
} from '../../../../__tests__/helpers/actionFixtures';
import { ToastProvider } from '../../../../shared/components/Toast';
import { ObjectMenuProvider } from '../../../actions/components/ObjectMenuProvider';
import { selectOpenDrawer } from '../../../../store/slices/drawer/selectOpenDrawer';
import { ExplorePane } from '.';

let useAppStore: StoryStore;

const SESSION_ID: SessionId = SESSION;
const LEDGER_DIR = '/work/harborline/ledger-core-rounding';
const NOTIFY_DIR = '/work/harborline/notify-relay-retries';
const SCRATCH_DIR = '/scratch/session-payout-export';
const LEDGER_ROOT = '/work/harborline/ledger-core';
const GONE_SENTENCE = 'Closed. Its files were removed.';

const isMountId = (value: string): value is MountId => value !== '';

const mountIdOf = ({ raw }: { readonly raw: string }): MountId => {
  if (!isMountId(raw)) {
    throw new Error('A mount id is never empty');
  }
  return raw;
};

const LEDGER_PROJECT: Project = aProject({
  id: mountFixture().projectId,
  workspaceId: WORKSPACE,
  name: 'ledger-core',
  rootPath: LEDGER_ROOT,
  kind: 'repo',
});
const NOTIFY_PROJECT: Project = aProject({ name: 'notify-relay', kind: 'repo' });

const LEDGER: SessionProjectMount = mountFixture({
  projectId: LEDGER_PROJECT.id,
  mountName: 'ledger-core',
  worktreePath: LEDGER_DIR,
  branch: 'hl/ledger-rounding',
});
const NOTIFY: SessionProjectMount = mountFixture({
  mountId: mountIdOf({ raw: 'mount-notify-relay' }),
  projectId: NOTIFY_PROJECT.id,
  mountName: 'notify-relay',
  worktreePath: NOTIFY_DIR,
  branch: 'hl/notify-retries',
  parallelIndex: 1,
});

const viewOf = (
  mount: SessionProjectMount,
  overrides: Partial<SessionMountView> = {},
): SessionMountView => ({
  id: mount.mountId,
  sessionId: mount.sessionId,
  projectId: mount.projectId,
  worktreePath: mount.worktreePath,
  lastWorktreePath: mount.lastWorktreePath,
  branch: mount.branch,
  baseBranch: mount.baseBranch,
  parallelIndex: mount.parallelIndex,
  mountName: mount.mountName,
  repoSlug: null,
  isAttached: true,
  diskState: 'present',
  revision: 1,
  createdAt: FIXTURE_NOW,
  updatedAt: FIXTURE_NOW,
  repoRoot: mount.repoRoot,
  ...overrides,
});

const entry = ({
  relPath,
  isDir = false,
}: {
  readonly relPath: string;
  readonly isDir?: boolean;
}) => ({
  name: relPath.slice(relPath.lastIndexOf('/') + 1),
  relPath,
  isDir,
  sizeBytes: isDir ? 0 : 120,
  modifiedAt: '2026-09-14T15:40:00.000Z',
});

const list = ({
  dir,
  entries,
}: {
  readonly dir: string;
  readonly entries: ReadonlyArray<unknown>;
}) => {
  h.lists.set(`${dir}\n`, entries);
};

type SeedParams = {
  readonly mounts: ReadonlyArray<SessionProjectMount>;
  readonly active: SessionProjectMount | null;
};

const seed = ({ mounts, active }: SeedParams) => {
  useAppStore.setState({
    projects: [LEDGER_PROJECT, NOTIFY_PROJECT],
    sessionProjectMounts: { [SESSION_ID]: mounts },
    sessionActiveMount: active === null ? {} : { [SESSION_ID]: active.mountId },
  });
};

const Shell = () => (
  <ToastProvider>
    <ObjectMenuProvider>
      <ExplorePane sessionId={SESSION_ID} />
    </ObjectMenuProvider>
  </ToastProvider>
);

const mountPane = () => render(<Shell />);

const rowNamed = async (name: string) => screen.findByRole('treeitem', { name });

const listedDirs = (): ReadonlyArray<unknown> =>
  h.invoke.mock.calls
    .filter(([command]) => command === 'explore_list')
    .map(([, args]) => args?.['sessionDir']);

const projectChip = (name: string) => screen.getByRole('button', { name });

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  h.lists.clear();
  h.scratch.current = SCRATCH_DIR;
  h.invoke.mockReset();
  h.invoke.mockImplementation(async (command, args = {}) => {
    if (command === 'explore_list') {
      return h.lists.get(`${String(args['sessionDir'])}\n${String(args['relPath'])}`) ?? [];
    }
    if (command === 'scratch_dir_prepare') {
      if (h.scratch.current instanceof Error) {
        throw h.scratch.current;
      }
      return h.scratch.current;
    }
    if (command === 'detect_editors') {
      return [];
    }
    return undefined;
  });
  useAppStore.setState({ sessions: [sessionFixture()], currentSessionId: SESSION_ID });
  list({
    dir: LEDGER_DIR,
    entries: [entry({ relPath: 'README.md' }), entry({ relPath: 'rounding.ts' })],
  });
  list({
    dir: NOTIFY_DIR,
    entries: [entry({ relPath: 'README.md' }), entry({ relPath: 'retry.ts' })],
  });
  list({ dir: SCRATCH_DIR, entries: [entry({ relPath: 'notes.txt' })] });
  list({ dir: LEDGER_ROOT, entries: [entry({ relPath: 'package.json' })] });
});

afterEach(cleanup);

describe('the Explore project chip with one project', () => {
  it('names the project and the branch as plain text, with no menu', async () => {
    seed({ mounts: [LEDGER], active: LEDGER });
    mountPane();

    await rowNamed('README.md');
    expect(screen.getByTestId('explore-project').textContent).toContain('ledger-core');
    expect(screen.getByTestId('explore-project').textContent).toContain('hl/ledger-rounding');
    expect(screen.queryByRole('button', { name: /^Project / })).toBeNull();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('reads a folder project by its name alone', async () => {
    seed({ mounts: [{ ...LEDGER, branch: '' }], active: LEDGER });
    mountPane();

    await rowNamed('README.md');
    expect(screen.getByTestId('explore-project').textContent).toBe('ledger-core');
  });
});

describe('the Explore project chip with two projects', () => {
  it('opens a menu grouped by project with a check on the one shown', async () => {
    seed({ mounts: [LEDGER, NOTIFY], active: LEDGER });
    mountPane();
    await rowNamed('README.md');

    fireEvent.click(projectChip('Project ledger-core, hl/ledger-rounding'));

    const menu = await screen.findByRole('menu', { name: 'Projects' });
    expect(within(menu).getByRole('group', { name: 'ledger-core' })).toBeDefined();
    expect(within(menu).getByRole('group', { name: 'notify-relay' })).toBeDefined();
    const rows = within(menu).getAllByRole('menuitemradio');
    expect(rows.map((row) => row.getAttribute('aria-checked'))).toEqual(['true', 'false']);
  });

  it('browses the project you pick and leaves the write destination alone', async () => {
    const setSessionActiveMount = vi.fn(async () => undefined);
    seed({ mounts: [LEDGER, NOTIFY], active: LEDGER });
    useAppStore.setState({ setSessionActiveMount });
    mountPane();
    await rowNamed('rounding.ts');

    fireEvent.click(projectChip('Project ledger-core, hl/ledger-rounding'));
    fireEvent.click(
      within(await screen.findByRole('menu', { name: 'Projects' })).getByRole('menuitemradio', {
        name: /hl\/notify/,
      }),
    );

    expect(await rowNamed('retry.ts')).toBeDefined();
    expect(screen.queryByRole('treeitem', { name: 'rounding.ts' })).toBeNull();
    expect(useAppStore.getState().exploreMountPath[SESSION_ID]).toBe(NOTIFY_DIR);
    expect(useAppStore.getState().sessionActiveMount[SESSION_ID]).toBe(LEDGER.mountId);
    expect(setSessionActiveMount).not.toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: 'Project notify-relay, hl/notify-retries' }),
    ).toBeDefined();
  });

  it('keeps what you browse when the write destination moves', async () => {
    seed({ mounts: [LEDGER, NOTIFY], active: LEDGER });
    act(() =>
      useAppStore.getState().setExploreMountPath({ sessionId: SESSION_ID, mountPath: LEDGER_DIR }),
    );
    mountPane();
    await rowNamed('rounding.ts');

    act(() => useAppStore.setState({ sessionActiveMount: { [SESSION_ID]: NOTIFY.mountId } }));

    expect(await rowNamed('rounding.ts')).toBeDefined();
    expect(screen.queryByRole('treeitem', { name: 'retry.ts' })).toBeNull();
    expect(listedDirs()).not.toContain(NOTIFY_DIR);
  });

  it('follows the write destination until you pick', async () => {
    seed({ mounts: [LEDGER, NOTIFY], active: LEDGER });
    mountPane();
    await rowNamed('rounding.ts');

    act(() => useAppStore.setState({ sessionActiveMount: { [SESSION_ID]: NOTIFY.mountId } }));

    expect(await rowNamed('retry.ts')).toBeDefined();
  });

  it('replaces the open file when the same path opens in the other project', async () => {
    seed({ mounts: [LEDGER, NOTIFY], active: LEDGER });
    mountPane();
    fireEvent.click(await rowNamed('README.md'));
    expect(selectOpenDrawer(useAppStore.getState())).toMatchObject({
      kind: 'explore-file',
      payload: { sessionDir: LEDGER_DIR },
    });

    act(() =>
      useAppStore.getState().setExploreMountPath({ sessionId: SESSION_ID, mountPath: NOTIFY_DIR }),
    );
    await rowNamed('retry.ts');
    expect((await rowNamed('README.md')).getAttribute('aria-selected')).toBe('false');
    fireEvent.click(await rowNamed('README.md'));

    expect(selectOpenDrawer(useAppStore.getState())).toMatchObject({
      kind: 'explore-file',
      payload: { sessionDir: NOTIFY_DIR },
    });
  });

  it('remembers the open folders of each project apart', async () => {
    list({ dir: LEDGER_DIR, entries: [entry({ relPath: 'docs', isDir: true })] });
    h.lists.set(`${LEDGER_DIR}\ndocs`, [entry({ relPath: 'docs/rounding.md' })]);
    list({ dir: NOTIFY_DIR, entries: [entry({ relPath: 'docs', isDir: true })] });
    seed({ mounts: [LEDGER, NOTIFY], active: LEDGER });
    mountPane();

    fireEvent.click(await rowNamed('docs'));
    await rowNamed('rounding.md');
    act(() =>
      useAppStore.getState().setExploreMountPath({ sessionId: SESSION_ID, mountPath: NOTIFY_DIR }),
    );

    expect((await rowNamed('docs')).getAttribute('aria-expanded')).toBe('false');
    expect(useAppStore.getState().exploreExpanded[SESSION_ID]?.[LEDGER_DIR]).toEqual({
      docs: true,
    });

    act(() =>
      useAppStore.getState().setExploreMountPath({ sessionId: SESSION_ID, mountPath: LEDGER_DIR }),
    );

    expect((await rowNamed('docs')).getAttribute('aria-expanded')).toBe('true');
    expect(await rowNamed('rounding.md')).toBeDefined();
  });
});

describe('the Explore project chip without a mounted project', () => {
  it('names the project folder during the first lap', async () => {
    useAppStore.setState({
      projects: [LEDGER_PROJECT],
      bootstrapPhase: {
        [LEDGER_PROJECT.id]: {
          stage: 'first-lap',
          firstLapSessionId: SESSION_ID,
          bootstrapSessionId: null,
          snapshotId: null,
          worktreePath: null,
          branch: null,
          updatedAt: FIXTURE_NOW,
        },
      },
    });
    mountPane();

    expect(await rowNamed('package.json')).toBeDefined();
    expect(screen.getByTestId('explore-project').textContent).toBe('ledger-core, project folder');
    expect(listedDirs()).toEqual([LEDGER_ROOT]);
  });

  it('browses the scratch folder of a session without a project', async () => {
    useAppStore.setState({ projects: [LEDGER_PROJECT] });
    mountPane();

    expect(await rowNamed('notes.txt')).toBeDefined();
    expect(screen.getByTestId('explore-project').textContent).toBe('Session scratch folder');
  });

  it('says there is nothing to browse yet when the scratch folder is not available', async () => {
    h.scratch.current = new Error('The scratch folder is not available');
    useAppStore.setState({ projects: [LEDGER_PROJECT] });
    mountPane();

    expect(await screen.findByText('Nothing to browse yet')).toBeDefined();
    expect(
      screen.getByText('Files show here once a project is mounted for this session.'),
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    expect(screen.queryByTestId('explore-project')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Refresh the files' })).toBeNull();
  });
});

describe('the Explore project chip when the worktree is gone', () => {
  const seedGone = () => {
    useAppStore.setState({
      projects: [LEDGER_PROJECT, NOTIFY_PROJECT],
      sessionMounts: {
        [SESSION_ID]: [
          viewOf(LEDGER),
          viewOf(NOTIFY, {
            worktreePath: null,
            lastWorktreePath: NOTIFY_DIR,
            diskState: 'removed',
          }),
        ],
      },
      sessionProjectMounts: { [SESSION_ID]: [LEDGER] },
      sessionActiveMount: { [SESSION_ID]: LEDGER.mountId },
      exploreMountPath: { [SESSION_ID]: NOTIFY_DIR },
    });
  };

  it('says so with the sentence of the Projects row', async () => {
    seedGone();
    mountPane();

    expect(await screen.findByText('This worktree is gone')).toBeDefined();
    expect(screen.getByText(GONE_SENTENCE)).toBeDefined();
    expect(screen.queryByRole('tree')).toBeNull();
    expect(listedDirs()).toEqual([]);
  });

  it('goes back to the project agents write in with one click', async () => {
    seedGone();
    mountPane();

    fireEvent.click(await screen.findByRole('button', { name: 'Show the current project' }));

    expect(await rowNamed('rounding.ts')).toBeDefined();
    await waitFor(() =>
      expect(useAppStore.getState().exploreMountPath[SESSION_ID] ?? null).toBeNull(),
    );
  });
});
