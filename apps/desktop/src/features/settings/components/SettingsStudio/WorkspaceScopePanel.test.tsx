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
import type { SettingsScopeChange } from '../../settingsFocus';
import { WORKSPACE_PAGES } from './workspacePages';
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

const savedOverrides = (): ReadonlyArray<OverrideSettings> =>
  invokes('set_workspace_overrides').map(
    (call) => (call.args as { readonly overrides: OverrideSettings }).overrides,
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
    set_workspace_overrides: null,
    get_workspace_overrides: (args: { readonly workspaceId: WorkspaceId }) =>
      args.workspaceId === NORTHWIND.id ? northwind : harborline,
  });
  useAppStore.setState({
    workspaces: [HARBORLINE, NORTHWIND],
    currentWorkspaceId: HARBORLINE.id,
    workspaceOverrides: { [HARBORLINE.id]: harborline },
    settings: { ...settings },
  });
};

const onSelect = vi.fn<(change: SettingsScopeChange) => void>();

const renderPage = ({
  section,
  requestClose = vi.fn(),
}: {
  readonly section?: string;
  readonly requestClose?: () => void;
} = {}) =>
  render(
    <ToastProvider>
      <WorkspaceScopePanel
        workspaceId={HARBORLINE.id}
        section={section}
        onSelect={onSelect}
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
  onSelect.mockReset();
  seed();
});

afterEach(cleanup);

describe('WorkspaceScopePanel pages', () => {
  it('opens on Projects with the workspace name, and one page per section', () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Projects');
    expect(screen.getByLabelText<HTMLInputElement>('Workspace name').value).toBe('Harborline');
    expect(screen.queryByRole('region', { name: 'Branches and comments' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Disconnect workspace' })).toBeNull();
  });

  it.each(WORKSPACE_PAGES.map((page) => page.id).filter((id) => id !== 'projects'))(
    'puts every part of %s in a titled region with a card',
    (section) => {
      renderPage({ section });

      const regions = screen.getAllByRole('region');
      expect(regions.length).toBeGreaterThan(0);
      regions.forEach((region) => {
        expect(within(region).getAllByRole('heading', { level: 2 }).length).toBeGreaterThan(0);
        expect(region.querySelector('[data-band]')).not.toBeNull();
      });
    },
  );

  it('lands old anchors on their page', () => {
    renderPage({ section: 'after-merge' });
    screen.getByRole('region', { name: 'After a pull request merges' });
    cleanup();

    renderPage({ section: 'review-replies' });
    screen.getByRole('region', { name: 'Voice' });
    cleanup();

    renderPage({ section: 'permissions' });
    screen.getByRole('region', { name: 'Recent decisions' });
  });

  it('keeps the attribution line on New sessions and links to it from Review replies', () => {
    renderPage({ section: 'review-replies' });

    fireEvent.click(screen.getByRole('button', { name: 'Edit in New sessions' }));

    expect(onSelect).toHaveBeenCalledWith({ scope: 'workspace', section: 'general' });
  });

  it('persists the attribution switch through the queued writer', async () => {
    renderPage({ section: 'general' });
    const region = screen.getByRole('region', { name: 'Branches and comments' });

    fireEvent.click(within(region).getByRole('switch'));

    await waitFor(() => expect(savedOverrides()).toHaveLength(1));
    expect(savedOverrides()[0]).toEqual({ ...EMPTY_OVERRIDES, attributionFooter: false });
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

describe('disconnect page', () => {
  it('disconnects only after the inline confirm, then closes settings', async () => {
    const disconnectWorkspace = vi.fn(async () => undefined);
    useAppStore.setState({ disconnectWorkspace });
    const requestClose = vi.fn();
    renderPage({ section: 'danger', requestClose });

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
    renderPage({ section: 'danger' });

    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));

    screen.getByRole('group', { name: 'Disconnect Harborline and stop 2 active sessions?' });
  });
});

describe('changed from default', () => {
  it('marks a value that differs from the default and resets it to null', async () => {
    seed({ harborline: overrides({ defaultBranchPrefix: 'hl', defaultVerbosity: 'normal' }) });
    renderPage({ section: 'general' });

    screen.getByRole('img', { name: 'Changed from default. Default: goodboy' });
    expect(screen.getAllByRole('img', { name: /Changed from default/ })).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Branch prefix options' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Reset/ }));

    await waitFor(() => expect(savedOverrides()).toHaveLength(1));
    expect(savedOverrides()[0]?.defaultBranchPrefix).toBeNull();
    expect(screen.queryByRole('img', { name: /Changed from default/ })).toBeNull();
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
      within(pageMenu('Review replies')).getByRole('menuitem', { name: /Restore defaults/ }),
    );
    const flow = screen.getByRole('region', { name: 'Restore defaults' });
    expect(flow.textContent).toContain('Goes back to the default: 2 settings on 1 page.');
    fireEvent.click(within(flow).getByRole('button', { name: 'Restore 2 settings' }));

    await waitFor(() => expect(savedOverrides()).toHaveLength(1));
    expect(savedOverrides()[0]).toEqual({
      ...EMPTY_OVERRIDES,
      replyVoice: null,
      resolveCommitStyle: null,
      attributionFooter: false,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(savedOverrides()).toHaveLength(2));
    expect(savedOverrides()[1]?.replyVoice).toBe('friendly');
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
      within(pageMenu('Review replies')).getByRole('menuitem', { name: /Copy from/ }),
    );
    const flow = screen.getByRole('region', { name: 'Copy settings from another workspace' });
    fireEvent.click(await within(flow).findByRole('radio', { name: /Northwind/ }));
    fireEvent.click(within(flow).getByRole('button', { name: 'Preview changes' }));

    expect(flow.textContent).toContain('Will change 3 settings on 1 page.');
    within(flow).getByText(
      'Voice: Friendly → Formal, Resolve the thread after replying: On → Off, 1 more',
    );
    expect(flow.textContent).toContain('Stays: projects, folders, accounts, permission history.');
    fireEvent.click(within(flow).getByRole('button', { name: 'Copy 3 settings' }));

    await screen.findByText('Copied 3 settings from Northwind.');
    expect(savedOverrides()).toEqual([
      {
        ...EMPTY_OVERRIDES,
        replyVoice: 'formal',
        resolveOnGithub: false,
        defaultBranchPrefix: 'hl',
      },
    ]);
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

    expect(flow.textContent).toContain('Will change 3 settings on 3 pages.');
    ['New sessions', 'After merge', 'Review replies'].forEach((page) =>
      within(flow).getByRole('checkbox', { name: `Include ${page}` }),
    );
    fireEvent.click(within(flow).getByRole('checkbox', { name: 'Include After merge' }));
    fireEvent.click(within(flow).getByRole('button', { name: 'Copy 2 settings' }));

    await screen.findByText('Copied 2 settings from Northwind.');
    expect(savedOverrides()).toEqual([
      { ...EMPTY_OVERRIDES, defaultBranchPrefix: 'nw', replyVoice: 'formal' },
    ]);
  });
});

describe('dev project', () => {
  it('converts a plain folder inline on Projects, never in a dialog', () => {
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
    renderPage({ section: 'dev-project' });

    const region = screen.getByRole('region', { name: 'Turn this into a dev project' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(
      within(region).getByText(/Git starts tracking \/work\/harborline\/runbooks/),
    ).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Hide' }));
    expect(screen.queryByRole('region', { name: 'Turn this into a dev project' })).toBeNull();
    act(() => undefined);
  });
});
