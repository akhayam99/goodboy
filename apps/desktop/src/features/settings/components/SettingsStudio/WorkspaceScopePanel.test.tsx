// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../store/storyHarness')).dbModuleMock({
    renameWorkspace: vi.fn(async () => undefined),
    upsertWorkspaceProfile: vi.fn(async () => undefined),
    setWorkspacePermissionDefault: vi.fn(async () => undefined),
    listDeletedBranches: vi.fn(async () => []),
    listExpiredDeletedBranches: vi.fn(async () => []),
    listMergedRequestHeads: vi.fn(async () => []),
    listGoodboyBranches: vi.fn(async () => []),
  }),
);
vi.mock('../../../permissions/permissions', async () =>
  (await import('../../../../store/storyHarness')).permissionsModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type {
  OverrideSettings,
  ProjectId,
  ProviderRunId,
  Workspace,
  WorkspaceId,
} from '@goodboy/types';
import { aProject, aSession, aWorkspace, EMPTY_OVERRIDES, TEST_NOW } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ToastProvider } from '../../../../shared/components/Toast';
import { NAMES } from '../../../../shared/utils/names';
import { PLAN_PAGES, planPageLabel } from './workspacePages';
import { WorkspaceScopePanel } from './WorkspaceScopePanel';

let useAppStore: StoryStore;

const HARBORLINE: Workspace = aWorkspace({ name: 'Harborline', slug: 'harborline' });
const NORTHWIND: Workspace = aWorkspace({ name: 'Northwind', slug: 'northwind' });

const overrides = (patch: Partial<OverrideSettings>): OverrideSettings => ({
  ...EMPTY_OVERRIDES,
  ...patch,
});

type InvokeCall = { readonly command: string; readonly args: unknown };

const invokes = (command: string): ReadonlyArray<InvokeCall> =>
  storySpies.tauriInvoke.mock.calls
    .map(([name, args]) => ({ command: String(name), args }))
    .filter((call) => call.command === command);

const savedPatches = (): ReadonlyArray<Partial<OverrideSettings>> =>
  invokes('patch_workspace_overrides').map(
    (call) => (call.args as { readonly patch: Partial<OverrideSettings> }).patch,
  );

const seed = ({
  harborline = EMPTY_OVERRIDES,
  northwind = EMPTY_OVERRIDES,
  settings = {},
}: {
  readonly harborline?: OverrideSettings;
  readonly northwind?: OverrideSettings;
  readonly settings?: Readonly<Record<string, string>>;
} = {}) => {
  stubStoryInvoke({
    patch_workspace_overrides: null,
    get_workspace_overrides: (args: { readonly workspaceId: WorkspaceId }) =>
      args.workspaceId === NORTHWIND.id ? northwind : harborline,
    project_branches: { userEmail: 'mara@harborline.test', branches: [] },
    gh_run: { stdout: '', stderr: '', exitCode: 1 },
  });
  useAppStore.setState({
    workspaces: [HARBORLINE, NORTHWIND],
    currentWorkspaceId: HARBORLINE.id,
    workspaceOverrides: { [HARBORLINE.id]: harborline },
    settings: { ...settings },
  });
};

const renderPage = ({
  section,
  initialFlow,
  requestClose = vi.fn(),
}: {
  readonly section?: string;
  readonly initialFlow?: 'copy' | 'restore';
  readonly requestClose?: () => void;
} = {}) =>
  render(
    <ToastProvider>
      <WorkspaceScopePanel
        workspaceId={HARBORLINE.id}
        section={section}
        initialFlow={initialFlow}
        requestClose={requestClose}
      />
    </ToastProvider>,
  );

const pageMenu = (label: string) => {
  fireEvent.click(screen.getByRole('button', { name: `${label} actions` }));
  return screen.getByRole('menu', { name: `${label} actions` });
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  seed();
});

afterEach(cleanup);

const RUN_DEFAULT_ROWS: ReadonlyArray<readonly [string, ReadonlyArray<string>]> = [
  ['New runs', ['Workflow asks you', 'Lead asks you', 'Start as', NAMES.spendCap, NAMES.models]],
  ['Agents', ['Parallel agents', 'Reply length']],
];

const runDefaultBands = () =>
  screen
    .getAllByRole('region')
    .map((band) => band.getAttribute('aria-label'))
    .filter((label) => label === 'New runs' || label === 'Agents' || label === 'Guidance');

const expectRunDefaultRows = () => {
  expect(runDefaultBands()).toEqual(['New runs', 'Agents', 'Guidance']);
  for (const [band, rows] of RUN_DEFAULT_ROWS) {
    const region = within(screen.getByRole('region', { name: band }));
    for (const row of rows) {
      region.getByText(row, { selector: 'span' });
    }
  }
  screen.getByRole('textbox', { name: 'Guidance' });
  expect(screen.queryByRole('region', { name: NAMES.asksYou })).toBeNull();
};

describe('WorkspaceScopePanel pages', () => {
  it('lays Run defaults out in three bands, the permission rows behind one chip', () => {
    renderPage({ section: 'general' });

    expectRunDefaultRows();
    screen.getByRole('button', { name: /^Asks you: / });
  });

  it('keeps the session row in New runs with a session open, the one place that sets it', () => {
    const session = aSession({ workspaceId: HARBORLINE.id, goal: 'Retry webhooks with backoff' });
    useAppStore.setState({ sessions: [session], currentSessionId: session.id });
    renderPage({ section: 'general' });

    const newRuns = within(screen.getByRole('region', { name: 'New runs' }));
    expect(newRuns.getAllByRole('tablist').map((row) => row.getAttribute('aria-label'))).toEqual([
      'Workflow asks you',
      'Start as',
      'New runs in this session start as',
      'At the limit',
    ]);
  });

  it('opens on Projects with the workspace name, and one page per section', () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Projects');
    expect(screen.getByLabelText<HTMLInputElement>('Workspace name').value).toBe('Harborline');
    expect(screen.queryByRole('region', { name: 'Branches and comments' })).toBeNull();
    const bands = screen.getAllByRole('region').map((region) => region.getAttribute('aria-label'));
    expect(bands[0]).toBe('Workspace');
    expect(bands.at(-1)).toBe('Danger zone');
  });

  it('shows the projects count once, from the header', () => {
    stubStoryInvoke({
      patch_workspace_overrides: null,
      get_workspace_overrides: () => EMPTY_OVERRIDES,
      project_git_status: {
        state: 'missing',
        branch: null,
        headSubject: null,
        upstreamDistance: { kind: 'unknown', reason: 'rev-list-failed' },
        workingTree: { kind: 'unknown', reason: 'status-read-failed' },
        upstream: null,
        inProgress: null,
      },
      folder_git_probe: ({ path }: { readonly path: string }) => ({
        path,
        state: 'none',
        rootPath: null,
        branch: null,
        commitCount: 0,
        remoteUrl: null,
      }),
    });
    useAppStore.setState({
      projects: [
        aProject({
          workspaceId: HARBORLINE.id,
          name: 'ledger-core',
          rootPath: '/repos/ledger-core',
        }),
        aProject({
          workspaceId: HARBORLINE.id,
          name: 'payments-api',
          rootPath: '/repos/payments-api',
        }),
        aProject({
          workspaceId: HARBORLINE.id,
          name: 'runbooks',
          kind: 'folder',
          rootPath: '/work/harborline/runbooks',
        }),
      ],
    });
    renderPage();

    const header = screen.getByRole('heading', { level: 1 }).closest('[data-page-header]');
    expect(header?.querySelector('[data-slot="pane-meta"]')?.textContent).toBe(
      '2 projects, 1 plain folder',
    );
    expect(screen.getAllByText(/^\d+ projects?\b/)).toHaveLength(1);
  });

  it.each(PLAN_PAGES.map((id) => ({ id, label: planPageLabel({ page: id }) })))(
    'gives $id one title and no sentence under it',
    ({ id, label }) => {
      renderPage({ section: id });

      const title = screen.getByRole('heading', { level: 1 });
      expect(title.textContent).toBe(label);
      const header = title.closest('[data-page-header]');
      expect(header?.querySelectorAll('p:not([data-slot="pane-meta"])')).toHaveLength(0);
      expect(header?.querySelector('[data-slot="pane-meta"]')?.textContent ?? '').not.toMatch(
        /\.$/,
      );
    },
  );

  it('says the workspace has no projects yet in the header', () => {
    renderPage();

    const header = screen.getByRole('heading', { level: 1 }).closest('[data-page-header]');
    expect(header?.querySelector('[data-slot="pane-meta"]')?.textContent).toBe('No projects yet');
  });

  it('opens Branches with Naming, then After merge, and no branch list', () => {
    renderPage({ section: 'branches' });

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Branches');
    const naming = screen.getByRole('region', { name: 'Naming' });
    const afterMerge = screen.getByRole('region', { name: 'After merge' });
    within(naming).getByLabelText('Branch prefix');
    within(naming).getByText('Branch name');
    expect(
      naming.compareDocumentPosition(afterMerge) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Branches' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Check again' })).toBeNull();
    expect(screen.queryByRole('combobox', { name: 'Storage scope' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Change' })).toBeNull();
  });

  it.each([
    ['copy', 'Copy settings from another workspace'],
    ['restore', 'Restore defaults'],
  ] as const)('opens the all-pages %s flow when asked to', (initialFlow, name) => {
    renderPage({ initialFlow });

    screen.getByRole('region', { name });
  });

  it('lands old anchors on their page', () => {
    renderPage({ section: 'after-merge' });
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Branches');
    screen.getByRole('region', { name: 'After merge' });
    cleanup();

    renderPage({ section: 'review-replies' });
    screen.getByRole('region', { name: 'Replies' });
    cleanup();

    renderPage({ section: 'permissions' });
    screen.getByRole('region', { name: 'Recent decisions' });
    cleanup();

    renderPage({ section: 'security-findings' });
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Permissions');
    screen.getByRole('region', { name: 'Secrets in saved scripts' });
  });

  it('puts the secrets band after Rules and before Recent decisions', () => {
    renderPage({ section: 'permissions' });

    const rules = screen.getByRole('region', { name: 'Rules' });
    const secrets = screen.getByRole('region', { name: 'Secrets in saved scripts' });
    const decisions = screen.getByRole('region', { name: 'Recent decisions' });
    expect(rules.compareDocumentPosition(secrets) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(
      secrets.compareDocumentPosition(decisions) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('keeps the branch names and the attribution line off Run defaults', () => {
    renderPage({ section: 'general' });
    expect(screen.queryByText('Attribution line')).toBeNull();
    expect(screen.queryByLabelText('Branch prefix')).toBeNull();
    expect(screen.queryByText('Branch name')).toBeNull();
    cleanup();

    renderPage({ section: 'review-replies' });
    within(screen.getByRole('region', { name: 'Replies' })).getByText('Attribution line');
  });

  it('persists the attribution switch through the queued writer', async () => {
    renderPage({ section: 'review-replies' });
    const region = screen.getByRole('region', { name: 'Replies' });

    fireEvent.click(within(region).getByRole('switch', { name: 'Attribution line' }));

    await waitFor(() => expect(savedPatches()).toHaveLength(1));
    expect(savedPatches()[0]).toEqual({ attributionFooter: false });
  });
});

describe('workspace name', () => {
  it('renames on blur and spends no write on an unchanged name', async () => {
    renderPage();
    const input = screen.getByLabelText('Workspace name');

    fireEvent.change(input, { target: { value: '  Harborline  ' } });
    fireEvent.blur(input);
    expect(useAppStore.getState().workspaces[0]?.name).toBe('Harborline');

    fireEvent.change(input, { target: { value: 'Harborline payments' } });
    fireEvent.blur(input);

    await waitFor(() =>
      expect(useAppStore.getState().workspaces[0]?.name).toBe('Harborline payments'),
    );
  });
});

describe('disconnect at the end of Projects', () => {
  it('disconnects only after the inline confirm, then closes settings', async () => {
    const disconnectWorkspace = vi.fn(async () => undefined);
    useAppStore.setState({ disconnectWorkspace });
    const requestClose = vi.fn();
    renderPage({ section: 'projects', requestClose });

    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
    expect(disconnectWorkspace).not.toHaveBeenCalled();
    const confirm = screen.getByRole('group', { name: 'Disconnect Harborline?' });
    fireEvent.click(within(confirm).getByRole('button', { name: 'Disconnect' }));

    await waitFor(() => expect(disconnectWorkspace).toHaveBeenCalledWith(HARBORLINE.id));
    await waitFor(() => expect(requestClose).toHaveBeenCalledOnce());
  });

  it('counts the active sessions it stops', () => {
    useAppStore.setState({
      sessions: [
        aSession({
          workspaceId: HARBORLINE.id,
          state: { kind: 'running', runId: 'r-1' as ProviderRunId, startedAt: TEST_NOW },
        }),
        aSession({
          workspaceId: HARBORLINE.id,
          state: { kind: 'running', runId: 'r-2' as ProviderRunId, startedAt: TEST_NOW },
        }),
      ],
    });
    renderPage({ section: 'projects' });

    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));

    screen.getByRole('group', { name: 'Disconnect Harborline and stop 2 active sessions?' });
  });
});

describe('changed from default', () => {
  it('marks a value that differs from the default and resets it to null', async () => {
    seed({ harborline: overrides({ defaultBranchPrefix: 'hl', defaultVerbosity: 'normal' }) });
    renderPage({ section: 'general' });
    expect(screen.queryByRole('button', { name: /^Reset .* to default$/ })).toBeNull();
    cleanup();

    renderPage({ section: 'branches' });

    expect(screen.getAllByRole('button', { name: /^Reset .* to default$/ })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Branch prefix options' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Reset Branch prefix to default' }));

    await waitFor(() => expect(savedPatches()).toHaveLength(1));
    expect(savedPatches()[0]?.defaultBranchPrefix).toBeNull();
    expect(screen.queryByRole('button', { name: /^Reset .* to default$/ })).toBeNull();
  });
});

describe('restore defaults', () => {
  it('previews what goes back and writes null in one patch, with undo', async () => {
    seed({
      harborline: overrides({
        replyVoice: 'friendly',
        resolveCommitStyle: 'fixup',
        attributionFooter: false,
      }),
    });
    renderPage({ section: 'review-replies' });

    fireEvent.click(
      within(pageMenu('Replies and commits')).getByRole('menuitem', { name: /Restore defaults/ }),
    );
    const flow = screen.getByRole('region', { name: 'Restore defaults' });
    expect(flow.textContent).toContain('Goes back to the default: 3 settings on 1 page.');
    fireEvent.click(within(flow).getByRole('button', { name: 'Restore 3 settings' }));

    await waitFor(() => expect(savedPatches()).toHaveLength(1));
    expect(savedPatches()[0]).toEqual({
      replyVoice: null,
      attributionFooter: null,
      resolveCommitStyle: null,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(savedPatches()).toHaveLength(2));
    expect(savedPatches()[1]?.replyVoice).toBe('friendly');
  });
});

describe('changed count per page', () => {
  it.each([
    ['general', 'Run defaults', '1 change'],
    ['branches', 'Branches', '2 changes'],
    ['review-replies', 'Replies and commits', '1 change'],
  ] as const)('counts the moved fields on %s', (section, label, hint) => {
    seed({
      harborline: overrides({
        defaultBranchPrefix: 'hl',
        defaultBranchTemplate: '{prefix}/{slug}',
        attributionFooter: false,
        defaultVerbosity: 'brief',
      }),
    });
    renderPage({ section });

    const restore = within(pageMenu(label)).getByRole('menuitem', { name: /Restore defaults/ });
    expect(restore.textContent).toContain(hint);
  });
});

describe('copy from another workspace', () => {
  it('copies one page in one atomic patch and leaves projects and bootstrap keys alone', async () => {
    const editKey = `review.edit_posted_reply.${NORTHWIND.id}`;
    seed({
      harborline: overrides({ replyVoice: 'friendly', defaultBranchPrefix: 'hl' }),
      northwind: overrides({ replyVoice: 'formal', resolveOnGithub: false, roleModels: {} }),
      settings: {
        [editKey]: '0',
        [`bootstrap.phase.${'proj-northwind'}`]: 'publish',
      },
    });
    useAppStore.setState({
      projects: [aProject({ id: 'proj-northwind' as ProjectId, workspaceId: NORTHWIND.id })],
    });
    renderPage({ section: 'review-replies' });

    fireEvent.click(
      within(pageMenu('Replies and commits')).getByRole('menuitem', { name: /Copy from/ }),
    );
    const flow = screen.getByRole('region', { name: 'Copy settings from another workspace' });
    fireEvent.click(await within(flow).findByRole('radio', { name: /Northwind/ }));
    fireEvent.click(within(flow).getByRole('button', { name: 'Preview changes' }));

    expect(flow.textContent).toContain('Will change 3 settings on 1 page.');
    within(flow).getByText('Voice: Friendly → Formal, Mark thread as resolved: On → Off, 1 more');
    expect(flow.textContent).toContain('Stays: folders, accounts, permission history.');
    fireEvent.click(within(flow).getByRole('button', { name: 'Copy 3 settings' }));

    await screen.findByText('Copied 3 settings from Northwind.');
    expect(savedPatches()).toEqual([{ replyVoice: 'formal', resolveOnGithub: false }]);
    const settingWrites = storySpies.setSetting.mock.calls.map((call: ReadonlyArray<unknown>) =>
      String(call[1]),
    );
    expect(settingWrites).toEqual([`review.edit_posted_reply.${HARBORLINE.id}`]);
    expect(useAppStore.getState().projects).toHaveLength(1);
  });

  it('copies the whole workspace from any page menu with a preview per page', async () => {
    seed({
      northwind: overrides({ defaultBranchPrefix: 'nw', afterMerge: 'ask', replyVoice: 'formal' }),
    });
    renderPage({ section: 'projects' });

    fireEvent.click(
      within(pageMenu('Projects')).getByRole('menuitem', { name: /Copy all pages from/ }),
    );
    const flow = screen.getByRole('region', { name: 'Copy settings from another workspace' });
    fireEvent.click(await within(flow).findByRole('radio', { name: /Northwind/ }));
    fireEvent.click(within(flow).getByRole('button', { name: 'Preview changes' }));

    expect(flow.textContent).toContain('Will change 3 settings on 2 pages.');
    ['Branches', 'Replies and commits'].forEach((page) =>
      within(flow).getByRole('checkbox', { name: `Include ${page}` }),
    );
    expect(within(flow).queryByRole('checkbox', { name: 'Include Run defaults' })).toBeNull();
    fireEvent.click(within(flow).getByRole('checkbox', { name: 'Include Replies and commits' }));
    fireEvent.click(within(flow).getByRole('button', { name: 'Copy 2 settings' }));

    await screen.findByText('Copied 2 settings from Northwind.');
    expect(savedPatches()).toEqual([{ defaultBranchPrefix: 'nw', afterMerge: 'ask' }]);
  });
});

describe('folders that use their own value', () => {
  const labelLine = (label: string) => screen.getByText(label).parentElement ?? document.body;

  it('says how many folders hold their own value, on the rows they override and no other', () => {
    useAppStore.setState({
      projects: [
        aProject({
          workspaceId: HARBORLINE.id,
          name: 'ledger-core',
          rootPath: '/repos/ledger-core',
          overrides: overrides({ defaultBranchPrefix: 'ledger' }),
        }),
        aProject({
          workspaceId: HARBORLINE.id,
          name: 'notify-relay',
          rootPath: '/repos/notify-relay',
          overrides: overrides({ defaultBranchPrefix: 'relay', defaultVerbosity: 'brief' }),
        }),
        aProject({
          workspaceId: HARBORLINE.id,
          name: 'payments-api',
          rootPath: '/repos/payments-api',
          overrides: overrides({ defaultBranchPrefix: 'old' }),
          disconnectedAt: TEST_NOW,
        }),
        aProject({
          workspaceId: NORTHWIND.id,
          name: 'cascadia',
          rootPath: '/repos/cascadia',
          overrides: overrides({ parallelAgents: true }),
        }),
      ],
    });
    renderPage({ section: 'branches' });

    within(labelLine('Branch prefix')).getByText('2 folders use their own');
    expect(within(labelLine('Branch name')).queryByText(/use their own|uses its own/)).toBeNull();
    expect(screen.getAllByText(/folders? use[s]? (their|its) own/)).toHaveLength(1);
    cleanup();

    renderPage({ section: 'general' });

    within(labelLine('Reply length')).getByText('1 folder uses its own');
    expect(
      within(labelLine('Parallel agents')).queryByText(/use their own|uses its own/),
    ).toBeNull();
    expect(screen.getAllByText(/folders? use[s]? (their|its) own/)).toHaveLength(1);
  });

  it('shows no chip while no folder holds a value of its own', () => {
    useAppStore.setState({
      projects: [
        aProject({
          workspaceId: HARBORLINE.id,
          name: 'ledger-core',
          rootPath: '/repos/ledger-core',
        }),
      ],
    });
    renderPage({ section: 'general' });

    expect(screen.queryByText(/use their own|uses its own/)).toBeNull();
  });

  it('keeps the reset button beside the chip on a row that also changed', () => {
    seed({ harborline: overrides({ defaultBranchPrefix: 'hl' }) });
    useAppStore.setState({
      projects: [
        aProject({
          workspaceId: HARBORLINE.id,
          name: 'ledger-core',
          rootPath: '/repos/ledger-core',
          overrides: overrides({ defaultBranchPrefix: 'ledger' }),
        }),
      ],
    });
    renderPage({ section: 'branches' });

    const line = within(labelLine('Branch prefix'));
    line.getByText('1 folder uses its own');
    line.getByRole('button', { name: 'Reset Branch prefix to default' });
  });
});

describe('track with git', () => {
  it('opens the first commit review inline on Projects, never in a dialog', async () => {
    stubStoryInvoke({
      patch_workspace_overrides: null,
      get_workspace_overrides: () => EMPTY_OVERRIDES,
      file_versions_folder_size: ({
        args,
      }: {
        readonly args: { readonly folderPath: string };
      }) => ({
        folderPath: args.folderPath,
        isReady: true,
        fileCount: 4,
        keptBytes: 12_000,
        versionBytes: 0,
        versionCount: 0,
        capBytes: 1024 * 1024 * 1024,
      }),
      folder_git_probe: ({ path }: { readonly path: string }) => ({
        path,
        state: 'none',
        rootPath: null,
        branch: null,
        commitCount: 0,
        remoteUrl: null,
      }),
      project_scripts_scan: () => [],
      folder_git_first_commit_plan: () => ({
        rootPath: '/work/harborline/runbooks',
        start: 'no_git',
        branch: 'main',
        author: { name: 'Dana Reyes', email: 'dana@acme.dev', isFallback: false },
        hasIgnoreFile: false,
        entries: [
          {
            key: '.',
            kind: 'included',
            files: 4,
            sample: ['Makefile', 'deploy.sh', 'rollback.sh'],
            isLeftOut: false,
            canToggle: false,
            ignore: null,
          },
        ],
      }),
    });
    useAppStore.setState({
      projects: [
        aProject({
          id: 'proj-runbooks' as ProjectId,
          workspaceId: HARBORLINE.id,
          name: 'runbooks',
          kind: 'folder',
          rootPath: '/work/harborline/runbooks',
        }),
      ],
    });
    renderPage({ section: 'track-with-git' });

    const region = await screen.findByRole('region', { name: 'Track runbooks with git' });
    expect(screen.queryByRole('dialog')).toBeNull();
    await within(region).findByText('4 files in the first commit');

    fireEvent.click(within(region).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('region', { name: 'Track runbooks with git' })).toBeNull();
    screen.getByRole('button', { name: 'Track with git' });
    act(() => undefined);
  });
});
