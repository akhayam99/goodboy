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
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { BaseDivergence, Project, WorkspaceGitStatus, WorkspaceId } from '@goodboy/types';
import { brandId } from '@goodboy/types';
import { aProject } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ToastProvider } from '../../../../shared/components/Toast';
import { RepoEntry } from './index';

let useAppStore: StoryStore;

const WORKSPACE = brandId<WorkspaceId>({ value: 'ws-harborline' });
const PAYMENTS = aProject({
  workspaceId: WORKSPACE,
  name: 'payments-api',
  kind: 'repo',
  rootPath: '/work/payments-api',
  baseBranch: 'main',
});
const LEDGER = aProject({
  workspaceId: WORKSPACE,
  name: 'ledger-core',
  kind: 'repo',
  rootPath: '/work/ledger-core',
  baseBranch: 'main',
});

type ReportParams = {
  readonly state: BaseDivergence['state'];
  readonly ahead?: number;
  readonly behind?: number;
  readonly uncommitted?: number;
  readonly checkoutBranch?: string;
};

const reportOf = ({
  state,
  ahead = 0,
  behind = 0,
  uncommitted = 0,
  checkoutBranch = 'main',
}: ReportParams): BaseDivergence => ({
  state,
  base: 'main',
  upstream: 'origin/main',
  ahead,
  behind,
  checkoutBranch,
  uncommitted,
  message: state === 'fetch-failed' ? 'Could not resolve host: github.com' : null,
});

type StatusParams = {
  readonly state?: WorkspaceGitStatus['state'];
  readonly behind?: number;
};

const statusOf = ({ state = 'ready', behind = 0 }: StatusParams): WorkspaceGitStatus => ({
  state,
  branch: state === 'ready' ? 'main' : null,
  headSubject: state === 'ready' ? 'Bump the lockfile' : null,
  upstreamDistance: { kind: 'known', ahead: 0, behind },
  workingTree: { kind: 'known', staged: 0, unstaged: 0, untracked: 0, unmerged: 0, changed: 0 },
  upstream: state === 'ready' ? 'origin/main' : null,
  inProgress: null,
});

type DivergenceArgs = {
  readonly projectPath: string;
  readonly maxAgeMs: number;
};

const isDivergenceArgs = (args: unknown): args is DivergenceArgs =>
  typeof args === 'object' && args !== null && 'maxAgeMs' in args && 'projectPath' in args;

type Answers = Readonly<Record<string, BaseDivergence>>;

type MountParams = {
  readonly projects: ReadonlyArray<Project>;
  readonly answers: Answers;
  readonly status?: WorkspaceGitStatus;
  readonly extra?: Readonly<Record<string, unknown>>;
};

const mount = async ({ projects, answers, status, extra = {} }: MountParams): Promise<void> => {
  useAppStore.setState({ projects, currentWorkspaceId: WORKSPACE });
  stubStoryInvoke({
    project_git_status: status ?? statusOf({}),
    repo_identity: null,
    worktree_repo_default_base_branch: 'main',
    worktree_list_branch_names: ['main'],
    repo_base_divergence: ({ projectPath }: DivergenceArgs) =>
      answers[projectPath] ?? reportOf({ state: 'up-to-date' }),
    ...extra,
  });
  render(
    <ToastProvider>
      <RepoEntry workspaceId={WORKSPACE} />
    </ToastProvider>,
  );
  await waitFor(() => expect(useAppStore.getState().repoCheckInFlight[WORKSPACE]).toBe(false));
};

const entry = (): HTMLElement => screen.getByRole('button', { name: /^Repositories/ });

const open = (): HTMLElement => {
  fireEvent.click(entry());
  return screen.getByRole('dialog', { name: 'Repositories' });
};

const rowOf = ({ name }: { readonly name: string }): HTMLElement => {
  const row = document.querySelector<HTMLElement>(`[data-repo-row="${name}"]`);
  if (row === null) {
    throw new Error(`no row for ${name}`);
  }
  return row;
};

const callsOf = ({ command }: { readonly command: string }) =>
  storySpies.tauriInvoke.mock.calls.filter(([name]) => name === command);

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

describe('the repositories entry in the top bar', () => {
  it('shows a dot and how far one repo is behind, and pulls it from its row', async () => {
    await mount({
      projects: [PAYMENTS, LEDGER],
      answers: { [PAYMENTS.rootPath]: reportOf({ state: 'behind', behind: 3 }) },
      extra: { checkout_update_base: { base: 'main', checkoutBranch: 'main', commitsPulled: 3 } },
    });

    expect(entry().textContent).toBe('3 behind');
    expect(entry().getAttribute('data-repo-entry')).toBe('info');
    const dialog = open();
    expect(within(rowOf({ name: 'payments-api' })).getByText('3 behind')).toBeDefined();
    expect(within(rowOf({ name: 'ledger-core' })).getByText('Up to date')).toBeDefined();
    expect(
      within(rowOf({ name: 'ledger-core' })).queryByRole('button', { name: /^Pull/ }),
    ).toBeNull();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Pull main in payments-api' }));

    await waitFor(() => expect(callsOf({ command: 'checkout_update_base' })).toHaveLength(1));
    expect(callsOf({ command: 'checkout_update_base' })[0]?.[1]).toEqual(
      expect.objectContaining({ checkoutPath: PAYMENTS.rootPath, baseBranch: 'main' }),
    );
  });

  it('offers Pull all for the repos that can fast-forward, never for a diverged one', async () => {
    await mount({
      projects: [PAYMENTS, LEDGER],
      answers: {
        [PAYMENTS.rootPath]: reportOf({ state: 'behind', behind: 3 }),
        [LEDGER.rootPath]: reportOf({ state: 'diverged', ahead: 1, behind: 2 }),
      },
      extra: { checkout_update_base: { base: 'main', checkoutBranch: 'main', commitsPulled: 3 } },
    });

    expect(entry().textContent).toBe('3 behind · Diverged');
    expect(entry().getAttribute('data-repo-entry')).toBe('warning');
    const dialog = open();
    expect(within(rowOf({ name: 'ledger-core' })).getByText('Diverged ↑1 ↓2')).toBeDefined();
    expect(
      within(rowOf({ name: 'ledger-core' })).queryByRole('button', { name: /^Pull/ }),
    ).toBeNull();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Pull all' }));

    await waitFor(() => expect(callsOf({ command: 'checkout_update_base' })).toHaveLength(1));
    expect(callsOf({ command: 'checkout_update_base' })[0]?.[1]).toEqual(
      expect.objectContaining({ checkoutPath: PAYMENTS.rootPath }),
    );
  });

  it('explains a dirty checkout on the base branch instead of offering Pull', async () => {
    await mount({
      projects: [PAYMENTS],
      answers: { [PAYMENTS.rootPath]: reportOf({ state: 'behind', behind: 3, uncommitted: 2 }) },
    });

    open();
    const row = rowOf({ name: 'payments-api' });
    expect(within(row).queryByRole('button', { name: /^Pull/ })).toBeNull();
    expect(
      within(row).getByText(
        '2 files have changes that are not committed. Commit or stash them first.',
      ),
    ).toBeDefined();
  });

  it('keeps the Pull width on a row without Pull, so the base column stays put', async () => {
    await mount({
      projects: [PAYMENTS],
      answers: { [PAYMENTS.rootPath]: reportOf({ state: 'behind', behind: 3, uncommitted: 2 }) },
    });

    open();
    const row = rowOf({ name: 'payments-api' });
    const slot = row.querySelector('[data-pull-slot]');
    expect(slot?.getAttribute('aria-hidden')).toBe('true');
    expect(slot?.querySelector('button')?.tabIndex).toBe(-1);
  });

  it('says a feature checkout stays where it is when main is pulled', async () => {
    await mount({
      projects: [PAYMENTS],
      answers: {
        [PAYMENTS.rootPath]: reportOf({
          state: 'behind',
          behind: 1,
          checkoutBranch: 'mara/ledger-export',
          uncommitted: 4,
        }),
      },
    });

    open();
    const row = rowOf({ name: 'payments-api' });
    expect(within(row).getByRole('button', { name: 'Pull main in payments-api' })).toBeDefined();
    expect(
      within(row).getByText(
        'Pull updates main without switching: your checkout stays on mara/ledger-export.',
      ),
    ).toBeDefined();
  });

  it('shows the refusal from git on the row when the pull is refused', async () => {
    await mount({
      projects: [PAYMENTS],
      answers: { [PAYMENTS.rootPath]: reportOf({ state: 'behind', behind: 3 }) },
      extra: {
        checkout_update_base: async () => {
          throw new Error('this checkout has uncommitted changes. commit or stash them first');
        },
      },
    });

    const dialog = open();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Pull main in payments-api' }));

    await waitFor(() =>
      expect(
        within(rowOf({ name: 'payments-api' })).getByText(/uncommitted changes/),
      ).toBeDefined(),
    );
  });

  it('stays quiet when every repo is up to date', async () => {
    await mount({ projects: [PAYMENTS, LEDGER], answers: {} });

    expect(entry().textContent).toBe('');
    expect(entry().getAttribute('data-repo-entry')).toBe('quiet');
    expect(entry().getAttribute('aria-label')).toBe('Repositories');
  });

  it('shows a quiet failure with Retry, and Retry fetches again without the cache', async () => {
    await mount({
      projects: [PAYMENTS],
      answers: { [PAYMENTS.rootPath]: reportOf({ state: 'fetch-failed' }) },
    });

    expect(entry().textContent).toBe('Check failed');
    const dialog = open();
    expect(within(dialog).getByText("Couldn't reach origin for 1 repo")).toBeDefined();

    stubStoryInvoke({
      project_git_status: statusOf({}),
      repo_identity: null,
      repo_base_divergence: reportOf({ state: 'behind', behind: 2 }),
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(entry().textContent).toBe('2 behind'));
    const last = callsOf({ command: 'repo_base_divergence' }).at(-1)?.[1];
    expect(isDivergenceArgs(last) ? last.maxAgeMs : null).toBe(0);
  });

  it('is absent from a workspace without repositories', async () => {
    useAppStore.setState({ projects: [], currentWorkspaceId: WORKSPACE });
    render(
      <ToastProvider>
        <RepoEntry workspaceId={WORKSPACE} />
      </ToastProvider>,
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByRole('button', { name: /^Repositories/ })).toBeNull();
  });
});

describe('the repository detail inside the entry', () => {
  it('opens the init guide for a folder without a repository and starts one', async () => {
    await mount({
      projects: [PAYMENTS],
      answers: {},
      status: statusOf({ state: 'absent' }),
      extra: { repo_init: null },
    });
    await act(async () => {
      await useAppStore.getState().loadProjectGitStatus({ projectId: PAYMENTS.id });
    });

    open();
    fireEvent.click(screen.getByRole('button', { name: 'payments-api' }));
    expect(screen.getByText('This folder has no git repository yet')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Start a repository' }));

    await waitFor(() =>
      expect(callsOf({ command: 'repo_init' })[0]?.[1]).toEqual({ path: PAYMENTS.rootPath }),
    );
  });

  it('fast-forwards the checkout from the detail and goes back to the list', async () => {
    await mount({
      projects: [PAYMENTS],
      answers: {},
      status: statusOf({ behind: 2 }),
      extra: {
        checkout_fast_forward: { branch: 'main', upstream: 'origin/main', commitsPulled: 2 },
      },
    });

    open();
    fireEvent.click(screen.getByRole('button', { name: 'payments-api' }));
    fireEvent.click(screen.getByRole('button', { name: /Fast-forward main to origin\/main/ }));
    await waitFor(() => expect(callsOf({ command: 'checkout_fast_forward' })).toHaveLength(1));

    fireEvent.click(screen.getByRole('button', { name: 'payments-api' }));
    expect(rowOf({ name: 'payments-api' })).toBeDefined();
  });

  it('shows an editor launch failure as an alert', async () => {
    await mount({
      projects: [PAYMENTS],
      answers: {},
      extra: {
        open_in_editor: async () => {
          throw new Error('editor unavailable');
        },
      },
    });

    open();
    fireEvent.click(screen.getByRole('button', { name: 'payments-api' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open in editor' }));

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('editor unavailable'),
    );
  });
});
