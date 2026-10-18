// @vitest-environment happy-dom

import type { ReactNode } from 'react';
import type { IsoDateTime, Workspace, WorkspaceId } from '@goodboy/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

const { scrollIntoViewMock, state, toastMock } = vi.hoisted(() => ({
  scrollIntoViewMock: vi.fn(),
  state: {
    githubWorkspaceStatus: {
      'workspace-1': { available: false, mode: 'absent', scoped: false },
    } as Record<string, unknown>,
    refreshGithubConnection: vi.fn(async () => undefined),
    githubStatus: { available: true, mode: 'absent', scopes: [] } as unknown,
    refreshGithubStatus: vi.fn(async () => undefined),
    loadSetting: vi.fn(async () => null),
    saveSetting: vi.fn(async () => undefined),
    backupExportGroups: {
      workspaces: true,
      projects: true,
      folderPaths: false,
      profile: true,
      workflowsYours: true,
      workflowsOrchestrated: false,
      scripts: true,
      permissionRules: true,
      budgetRules: true,
      integrations: true,
      appPreferences: true,
    },
    backupExportPreview: null as unknown,
    backupExportLeaveOut: [] as ReadonlyArray<string>,
    backupExportPhase: 'idle' as string,
    backupExportError: null as string | null,
    backupExportedPath: null as string | null,
    setBackupExportGroup: vi.fn(),
    loadBackupExportPreview: vi.fn(async () => undefined),
    setBackupFindingIncluded: vi.fn(),
    writeBackupExport: vi.fn(async () => null),
    resetBackupExport: vi.fn(),
    backupImportPath: null as string | null,
    backupImportProjectParent: null as string | null,
    backupImportPreview: null as unknown,
    backupImportWorkspaceTargets: {} as Record<string, string>,
    backupImportResolvedPaths: {} as Record<string, string>,
    backupImportPhase: 'idle' as string,
    backupImportError: null as string | null,
    backupImportResult: null as unknown,
    chooseBackupImportFile: vi.fn(async () => undefined),
    loadBackupImportPreview: vi.fn(async () => undefined),
    chooseBackupImportProjectParent: vi.fn(async () => undefined),
    setBackupImportWorkspaceTarget: vi.fn(),
    setBackupImportResolvedPath: vi.fn(),
    applyBackupImport: vi.fn(async () => undefined),
    resetBackupImport: vi.fn(),
    wipeLocalDatabase: vi.fn(async () => undefined),
    relaunchApp: vi.fn(async () => undefined),
    loadDetectedEditors: vi.fn(async () => undefined),
    detectedEditors: [] as ReadonlyArray<{ binary: string; label: string }>,
    loadDetectedBrowsers: vi.fn(async () => undefined),
    detectedBrowsers: [] as ReadonlyArray<{ id: string; label: string }>,
    workspaceIntegrations: {},
    integrationCredentials: [],
    integrationCredentialUsage: {},
    forgetIntegrationCredential: vi.fn(),
    connectLinear: vi.fn(),
    disconnectIntegration: vi.fn(),
    disconnectGithub: vi.fn(),
    storageStats: null,
    storageStatsLoading: false,
    reconcileOrphanWorktrees: vi.fn(async () => undefined),
    loadStorage: vi.fn(async () => undefined),
    storageOtherTools: { status: 'idle', tools: [] },
    loadOtherTools: vi.fn(async () => undefined),
    cancelOtherTools: vi.fn(async () => undefined),
    pruneArchivedTranscripts: vi.fn(async () => 0),
    storageFolders: [],
    storageArtifacts: [],
    storageDeletingArtifacts: {},
    storageRoots: [],
    storageFocus: null,
    storageOutcome: null,
    storageRemovingPaths: {},
    storageMeasuringPath: null,
    focusStorage: vi.fn(),
    settings: {},
    scanStorageRepository: vi.fn(async () => undefined),
    updaterStatus: 'idle' as string,
    updateVersion: null,
    updateFailure: null,
    updateCheckedAt: null,
    checkForUpdates: vi.fn(async () => undefined),
    providers: [] as ReadonlyArray<unknown>,
    cliRequirements: [] as ReadonlyArray<unknown>,
    agentTurnState: {},
    sessions: [] as ReadonlyArray<unknown>,
    sessionPhaseRuns: {},
    orchestratingWorkflowRuns: {},
    openSecurityFindings: {} as Record<string, ReadonlyArray<unknown>>,
    projects: [] as ReadonlyArray<unknown>,
    projectGitStatus: {} as Record<string, unknown>,
    workspaces: [] as ReadonlyArray<unknown>,
    workspaceOverrides: {} as Record<string, unknown>,
    lastSettingsFocus: null as unknown,
    rememberSettingsFocus: vi.fn(),
  },
  toastMock: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async () => ({ mode: 'absent', available: false, scoped: false })),
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: [],
  useAppStore: Object.assign(<T,>(selector: (store: typeof state) => T) => selector(state), {
    getState: () => state,
    subscribe: () => () => undefined,
  }),
  useSessions: () => [],
  useWorkspaces: () => [],
  useCurrentWorkspace: () => null,
}));

vi.mock('../../../providers/components/ProviderStudio', () => ({
  ProviderSettingsScope: ({
    frame,
  }: {
    readonly frame: (parts: { detail: ReactNode }) => ReactNode;
  }) => frame({ detail: <div>Provider settings content</div> }),
}));

vi.mock('./WorkspaceScopePanel', () => ({
  WorkspaceScopePanel: () => <div>Workspace settings content</div>,
}));

vi.mock('../../../../shared/components/Toast', () => ({
  useToast: () => ({ showToast: toastMock }),
}));

vi.mock('../../../onboarding/onboarding-store', () => ({
  reopenWizard: vi.fn(),
}));

import { SettingsStudio } from './index';
import { APP_SECTIONS } from './appSections';
import type { SettingsScopeChange } from '../../settingsFocus';
import { shortcutGlyphs, shortcutRangeGlyphs } from '../../../../shared/keyboard/registry';
import { SHORTCUT_ROW_COUNT } from './shortcutRows';

beforeEach(() => {
  Object.defineProperty(Element.prototype, 'scrollIntoView', {
    configurable: true,
    value: scrollIntoViewMock,
  });
  scrollIntoViewMock.mockReset();
  state.loadSetting.mockClear();
  state.loadDetectedEditors.mockClear();
  state.wipeLocalDatabase.mockClear();
  state.relaunchApp.mockClear();
  toastMock.mockReset();
});

afterEach(cleanup);

describe('SettingsStudio', () => {
  it('opens the actual tool form from a focused settings request', async () => {
    const workspace: Workspace = {
      id: 'workspace-1' as WorkspaceId,
      name: 'Workspace',
      slug: 'workspace',
      overrides: {
        defaultProviderId: null,
        defaultBranchPrefix: null,
        defaultVerbosity: null,
        providerBindings: null,
        taskModels: null,
        roleModels: null,
        parallelAgents: null,
        providerPool: null,
        attributionFooter: null,
        replyVoice: null,
        replyStyleNote: null,
        replyTemplateFixed: null,
        replyTemplateNoChange: null,
        resolveOnGithub: null,
        resolveCommitStyle: null,
        afterMerge: null,
        defaultBranchTemplate: null,
      },
      createdAt: '2026-09-01' as IsoDateTime,
      updatedAt: '2026-09-01' as IsoDateTime,
    };
    render(
      <SettingsStudio
        currentWorkspace={workspace}
        onScopeChange={vi.fn()}
        focus={{ scope: 'tools', tool: 'linear' }}
        onClose={vi.fn()}
      />,
    );
    expect((await screen.findByLabelText('API key')).id).toBe('linear-api-key');
    expect(screen.getAllByRole('navigation', { name: 'Settings scopes' })).toHaveLength(1);
    const integrations = within(
      screen.getByRole('navigation', { name: 'Settings scopes' }),
    ).getByRole('button', { name: /^Integrations/ });
    expect(integrations.getAttribute('aria-expanded')).toBe('true');
    expect(integrations.textContent).toBe('Integrations');
  });

  const renderApp = ({
    section,
    onScopeChange = vi.fn(),
  }: {
    readonly section?: string;
    readonly onScopeChange?: (params: SettingsScopeChange) => void;
  } = {}) =>
    render(
      <SettingsStudio
        currentWorkspace={null}
        onScopeChange={onScopeChange}
        focus={section === undefined ? { scope: 'app' } : { scope: 'app', section }}
        onClose={vi.fn()}
      />,
    );

  it('nests the app items under App in the one navigation rail', () => {
    renderApp();

    expect(screen.getAllByRole('navigation', { name: 'Settings scopes' })).toHaveLength(1);
    const items = screen.getByRole('list', { name: 'App settings' });
    expect(
      within(items)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(APP_SECTIONS.map((section) => section.label));
    expect(APP_SECTIONS.map((section) => section.id)).toEqual([
      'general',
      'updates',
      'shortcuts',
      'storage',
      'backup',
      'iphone',
    ]);
    expect(
      within(items).getByRole('button', { name: 'General' }).getAttribute('aria-current'),
    ).toBe('true');
    expect(screen.getByRole('heading', { name: 'General' })).toBeDefined();
    expect(screen.getByText('Open with')).toBeDefined();
    expect(screen.queryByRole('region', { name: 'Version' })).toBeNull();
  });

  it('gives Updates its own page with the installed version as its meta', () => {
    renderApp({ section: 'updates' });

    expect(screen.getByRole('heading', { level: 1, name: 'Updates' })).toBeDefined();
    expect(document.querySelector('[data-slot="pane-meta"]')?.textContent).toMatch(/^Goodboy /);
    expect(screen.getByRole('button', { name: "Open What's new" })).toBeDefined();
  });

  it.each([
    { section: 'security-findings', page: 'Storage', moved: { scope: 'app', section: 'storage' } },
    { section: 'branches', page: 'General', moved: { scope: 'workspace', section: 'branches' } },
  ])('moves the old $section link to its new page', ({ section, page, moved }) => {
    const onScopeChange = vi.fn();
    renderApp({ section, onScopeChange });

    expect(screen.getByRole('heading', { level: 1, name: page })).toBeDefined();
    expect(onScopeChange).toHaveBeenCalledWith(moved);
  });

  it('says why the workspace groups are empty, and lands providers on an account', () => {
    const { rerender } = render(
      <SettingsStudio
        currentWorkspace={null}
        onScopeChange={vi.fn()}
        focus={{ scope: 'workspace' }}
        onClose={vi.fn()}
      />,
    );

    const rail = screen.getByRole('navigation', { name: /settings scopes/i });
    expect(within(rail).queryByRole('list', { name: 'Workspace settings' })).toBeNull();
    expect(within(rail).queryByRole('button', { name: /^Integrations/ })).toBeNull();
    expect(within(rail).getByText('Open a workspace to see its settings.')).toBeDefined();
    expect(within(rail).getByText('Integrations belong to a workspace.')).toBeDefined();
    expect(
      within(rail).getByRole('button', { name: 'Providers and models', expanded: false }),
    ).toBeDefined();
    expect(screen.getByRole('heading', { name: 'General' })).toBeDefined();

    rerender(
      <SettingsStudio
        currentWorkspace={null}
        onScopeChange={vi.fn()}
        focus={{ scope: 'providers' }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('Provider settings content')).toBeDefined();
    expect(screen.getByRole('list', { name: 'App settings' })).toBeDefined();
    expect(
      within(rail).getByRole('button', { name: 'Providers and models', expanded: true }),
    ).toBeDefined();
    expect(screen.getAllByRole('navigation', { name: 'Settings scopes' })).toHaveLength(1);
  });

  it('keeps one rail mounted across scopes, opening Providers for a page inside it', () => {
    const { rerender } = renderApp();
    const rail = screen.getByRole('navigation', { name: /settings scopes/i });

    rerender(
      <SettingsStudio
        currentWorkspace={null}
        onScopeChange={vi.fn()}
        focus={{ scope: 'providers' }}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole('navigation', { name: /settings scopes/i })).toBe(rail);
    expect(within(rail).getByRole('list', { name: 'App settings' })).toBeDefined();
    expect(within(rail).getByRole('list', { name: 'Providers and models settings' })).toBeDefined();
    expect(screen.getByText('Provider settings content')).toBeDefined();

    rerender(
      <SettingsStudio
        currentWorkspace={null}
        onScopeChange={vi.fn()}
        focus={{ scope: 'app', section: 'storage' }}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole('navigation', { name: /settings scopes/i })).toBe(rail);
    expect(screen.queryByText('Provider settings content')).toBeNull();
    expect(within(rail).getByRole('button', { name: 'Storage' }).getAttribute('aria-current')).toBe(
      'true',
    );
  });

  it('shows tone on the rail only when something needs doing', () => {
    renderApp();
    const rail = screen.getByRole('navigation', { name: /settings scopes/i });
    expect(within(rail).queryByRole('img')).toBeNull();
    cleanup();

    state.updaterStatus = 'available';
    state.providers = [
      { id: 'anthropic', label: 'Claude', connection: 'connected', version: '2.1.200' },
    ];
    try {
      renderApp();
      const flagged = screen.getByRole('navigation', { name: /settings scopes/i });
      expect(within(flagged).getByRole('img', { name: 'Update available' })).toBeDefined();
      expect(
        within(within(flagged).getByRole('button', { name: /^Providers and models/ })).getByRole(
          'img',
          { name: 'Claude CLI needs an update' },
        ),
      ).toBeDefined();
    } finally {
      state.updaterStatus = 'idle';
      state.providers = [];
    }
  });

  it('keeps the closed providers group to one line, with no count, no tone and no usage', () => {
    state.providers = [
      { id: 'anthropic', label: 'Claude', connection: 'connected', version: '9.9.9' },
      { id: 'codex', label: 'Codex', connection: 'connected', version: '9.9.9' },
    ];
    try {
      renderApp();
      const rail = screen.getByRole('navigation', { name: /settings scopes/i });
      const group = within(rail).getByRole('button', { name: /^Providers and models/ });

      expect(group.textContent).toBe('Providers and models');
      expect(group.getAttribute('aria-expanded')).toBe('false');
      expect(within(rail).queryByRole('img')).toBeNull();
    } finally {
      state.providers = [];
    }
  });

  it('reports rail clicks as focus changes, and a fold click as no change at all', () => {
    const onScopeChange = vi.fn();
    renderApp({ onScopeChange });

    fireEvent.click(screen.getByRole('button', { name: 'Providers and models' }));
    fireEvent.click(screen.getByRole('button', { name: 'Storage' }));

    expect(onScopeChange.mock.calls).toEqual([[{ scope: 'app', section: 'storage' }]]);
    expect(screen.getByRole('heading', { name: 'General' })).toBeDefined();
  });

  it('opens the shortcuts item with the whole list visible', () => {
    renderApp({ section: 'shortcuts' });

    expect(screen.getByRole('heading', { name: 'Keyboard shortcuts' })).toBeDefined();
    expect(screen.getByText(`${SHORTCUT_ROW_COUNT} shortcuts`)).toBeDefined();
    expect(screen.getByText('Command palette')).toBeDefined();
    expect(screen.getByText(shortcutGlyphs('lens.agents'))).toBeDefined();
    expect(screen.getAllByRole('button', { name: /keyboard shortcuts/i })).toHaveLength(1);
  });

  it('groups shortcuts by task and folds the workspace digits into one row', () => {
    renderApp({ section: 'shortcuts' });

    for (const group of ['General', 'Workspaces', 'Navigate', 'Session', 'Views', 'Window']) {
      expect(screen.getByRole('heading', { name: group })).toBeDefined();
    }
    for (const group of ['Comments', 'Files']) {
      expect(screen.getByRole('heading', { name: group })).toBeDefined();
    }
    expect(screen.queryByRole('heading', { name: 'Review' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Diff' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Lens' })).toBeNull();
    expect(screen.getByText('Go to workspace 1 to 9')).toBeDefined();
    expect(
      screen.getByText(shortcutRangeGlyphs({ first: 'workspace.1', last: 'workspace.9' })),
    ).toBeDefined();
    expect(screen.queryByText('Workspace 2')).toBeNull();
  });

  it('falls back to General for an unknown section', () => {
    renderApp({ section: 'integrations' });

    expect(screen.getByRole('heading', { name: 'General' })).toBeDefined();
  });

  it('leaves GitHub to Integrations settings', () => {
    renderApp();

    expect(screen.queryByText('GitHub')).toBeNull();
    expect(screen.queryByText('Global fallback token used by every workspace.')).toBeNull();
  });

  it('deletes all data only after the row confirm and offers a restart', async () => {
    renderApp({ section: 'backup' });

    fireEvent.click(screen.getByRole('button', { name: 'Delete all data' }));
    expect(state.wipeLocalDatabase).not.toHaveBeenCalled();

    const confirm = screen.getByRole('group', {
      name: 'Delete every workspace, session and rule?',
    });
    fireEvent.click(within(confirm).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(state.wipeLocalDatabase).toHaveBeenCalledOnce());

    expect(await screen.findByText('Local data deleted.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Restart now' }));
    expect(state.relaunchApp).toHaveBeenCalledOnce();
  });

  it('cancels the delete back to its trigger', () => {
    renderApp({ section: 'backup' });

    fireEvent.click(screen.getByRole('button', { name: 'Delete all data' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(state.wipeLocalDatabase).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Delete all data' })).toBeDefined();
  });

  it('has no Help page, and the old Help anchor lands on General', () => {
    renderApp({ section: 'help' });

    const rail = screen.getByRole('navigation', { name: 'Settings scopes' });
    expect(within(rail).queryByRole('button', { name: 'Help' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'General' })).toBeDefined();
  });

  const renderHome = (onScopeChange = vi.fn()) =>
    render(
      <SettingsStudio
        currentWorkspace={null}
        onScopeChange={onScopeChange}
        focus={{ scope: 'home' }}
        onClose={vi.fn()}
      />,
    );

  it('opens on General the first time and keeps the rail in view', () => {
    const onScopeChange = vi.fn();
    renderHome(onScopeChange);

    expect(screen.getByRole('heading', { name: 'General' })).toBeDefined();
    expect(screen.getByRole('navigation', { name: 'Settings scopes' })).toBeDefined();
    expect(onScopeChange).toHaveBeenCalledWith({ scope: 'app', section: 'general' });
  });

  it('opens on the last visited page', () => {
    state.lastSettingsFocus = { scope: 'app', section: 'backup' };
    try {
      const onScopeChange = vi.fn();
      renderHome(onScopeChange);

      expect(screen.getByRole('heading', { name: 'Backup and reset' })).toBeDefined();
      expect(onScopeChange).toHaveBeenCalledWith({ scope: 'app', section: 'backup' });
    } finally {
      state.lastSettingsFocus = null;
    }
  });

  it('opens on General when the last page needs a workspace and there is none', () => {
    state.lastSettingsFocus = { scope: 'workspace', section: 'projects' };
    try {
      renderHome();

      expect(screen.getByRole('heading', { name: 'General' })).toBeDefined();
    } finally {
      state.lastSettingsFocus = null;
    }
  });

  it('opens on the new page when the last visit was an old one', () => {
    state.lastSettingsFocus = { scope: 'app', section: 'security-findings' };
    try {
      const onScopeChange = vi.fn();
      renderHome(onScopeChange);

      expect(screen.getByRole('heading', { level: 1, name: 'Storage' })).toBeDefined();
      expect(onScopeChange).toHaveBeenCalledWith({ scope: 'app', section: 'storage' });
    } finally {
      state.lastSettingsFocus = null;
    }
  });

  it('remembers the page it shows', () => {
    state.rememberSettingsFocus.mockClear();
    renderApp({ section: 'storage' });

    expect(state.rememberSettingsFocus).toHaveBeenCalledWith({ scope: 'app', section: 'storage' });
  });

  it('loads nothing heavy when it opens on General', () => {
    state.loadStorage.mockClear();
    state.scanStorageRepository.mockClear();
    renderHome();

    expect(state.loadStorage).not.toHaveBeenCalled();
    expect(state.scanStorageRepository).not.toHaveBeenCalled();
  });

  it('offers export and import under Backup', () => {
    renderApp({ section: 'backup' });

    expect(screen.getByRole('heading', { name: 'Backup and reset' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Export' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Import' })).toBeDefined();
  });
});

describe('SettingsStudio, the frame it draws', () => {
  const mountSlot = (): HTMLDivElement => {
    const slot = document.createElement('div');
    document.body.appendChild(slot);
    return slot;
  };

  it('draws only the page in the default shell, with the navigation in the column slot', () => {
    const slot = mountSlot();
    render(
      <SettingsStudio
        currentWorkspace={null}
        onScopeChange={vi.fn()}
        focus={{ scope: 'app' }}
        onClose={vi.fn()}
        columnSlot={slot}
        isInColumnShell
      />,
    );

    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).toBeNull();
    expect(document.querySelector('[data-studio-rail]')).toBeNull();
    expect(screen.queryByRole('complementary', { name: 'Settings scopes' })).toBeNull();
    const nav = within(slot).getByRole('navigation', { name: 'Settings scopes' });
    expect(within(slot).getAllByRole('button')[0]?.textContent).toContain('Back to app');
    expect(within(nav).getByRole('button', { name: 'General' })).toBeDefined();
    expect(screen.getByRole('heading', { name: 'General' })).toBeDefined();
    expect(screen.getAllByRole('navigation', { name: 'Settings scopes' })).toHaveLength(1);
    slot.remove();
  });

  it('draws the page before its navigation arrives, never a rail of its own', () => {
    render(
      <SettingsStudio
        currentWorkspace={null}
        onScopeChange={vi.fn()}
        focus={{ scope: 'app' }}
        onClose={vi.fn()}
        isInColumnShell
      />,
    );

    expect(document.querySelector('[data-studio-rail]')).toBeNull();
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).toBeNull();
    expect(screen.queryByRole('navigation', { name: 'Settings scopes' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'General' })).toBeDefined();
  });

  it('keeps the trail and the rail layout outside the column, in the launcher', () => {
    render(
      <SettingsStudio
        currentWorkspace={null}
        onScopeChange={vi.fn()}
        focus={{ scope: 'app' }}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeDefined();
    expect(document.querySelector('[data-studio-rail]')).not.toBeNull();
    expect(screen.getByRole('complementary', { name: 'Settings scopes' })).toBeDefined();
    expect(screen.queryByRole('button', { name: /^Back to app/ })).toBeNull();
  });
});
