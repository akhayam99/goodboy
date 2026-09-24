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
    exportConfig: vi.fn(async () => null),
    importConfig: vi.fn(async () => null),
    wipeLocalDatabase: vi.fn(async () => undefined),
    relaunchApp: vi.fn(async () => undefined),
    loadDetectedEditors: vi.fn(async () => undefined),
    detectedEditors: [] as ReadonlyArray<{ binary: string; label: string }>,
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
    loadStorageStats: vi.fn(async () => undefined),
    pruneArchivedTranscripts: vi.fn(async () => 0),
    removeArchivedWorktrees: vi.fn(async () => ({ removed: 0, failed: 0 })),
    updaterStatus: 'idle' as string,
    updateVersion: null,
    updateFailure: null,
    updateCheckedAt: null,
    checkForUpdates: vi.fn(async () => undefined),
    providers: [] as ReadonlyArray<unknown>,
    cliRequirements: [] as ReadonlyArray<unknown>,
    agentTurnState: {},
  },
  toastMock: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async () => ({ mode: 'absent', available: false, scoped: false })),
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: [],
  useAppStore: <T,>(selector: (store: typeof state) => T) => selector(state),
  useSessions: () => [],
}));

vi.mock('../../../providers/components/ProviderStudio', () => ({
  ProviderSettingsScope: ({
    frame,
  }: {
    readonly frame: (parts: { nested: ReactNode; detail: ReactNode }) => ReactNode;
  }) =>
    frame({
      nested: <ul aria-label="Providers & models settings" />,
      detail: <div>Provider settings content</div>,
    }),
}));

vi.mock('./WorkspaceScopePanel', () => ({
  WorkspaceScopePanel: () => <div>Workspace settings content</div>,
}));

vi.mock('../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast: toastMock }),
}));

vi.mock('../ImportConfigDialog', () => ({
  ImportConfigDialog: () => null,
}));

vi.mock('../../../onboarding/onboarding-store', () => ({
  reopenWizard: vi.fn(),
}));

import { SettingsStudio } from './index';
import { APP_SECTIONS } from './appSections';
import type { SettingsScopeChange } from './types';
import { REPORT_ISSUE_STUDIO_EVENT } from '../../reportIssueStudioEvent';
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
        defaultWorkflowId: null,
        defaultBranchPrefix: null,
        parallelEnabled: null,
        defaultVerbosity: null,
        providerBindings: null,
        taskModels: null,
        roleModels: null,
        parallelAgents: null,
        providerPool: null,
        attributionFooter: null,
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
    expect((await screen.findByLabelText('Personal API key')).id).toBe('linear-pat');
    expect(screen.getAllByRole('navigation')).toHaveLength(1);
    const tools = screen.getByRole('list', { name: 'Tools settings' });
    expect(
      within(tools)
        .getByRole('button', { name: /^Linear/ })
        .getAttribute('aria-current'),
    ).toBe('true');
    expect(screen.getByRole('button', { name: 'Tools' }).getAttribute('aria-current')).toBe(
      'false',
    );
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

    expect(screen.getAllByRole('navigation')).toHaveLength(1);
    const items = screen.getByRole('list', { name: 'App settings' });
    expect(
      within(items)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(APP_SECTIONS.map((section) => section.label));
    expect(APP_SECTIONS.map((section) => section.id)).toEqual([
      'general',
      'shortcuts',
      'backup',
      'storage',
      'help',
      'danger',
    ]);
    expect(
      within(items).getByRole('button', { name: 'General' }).getAttribute('aria-current'),
    ).toBe('true');
    expect(screen.getByRole('heading', { name: 'General' })).toBeDefined();
    expect(screen.getByText('Default editor')).toBeDefined();
  });

  it('lists only App and Providers without a workspace, and lands providers on an account', () => {
    const { rerender } = render(
      <SettingsStudio
        currentWorkspace={null}
        onScopeChange={vi.fn()}
        focus={{ scope: 'workspace' }}
        onClose={vi.fn()}
      />,
    );

    const rail = screen.getByRole('navigation', { name: /settings scopes/i });
    expect(within(rail).queryByRole('button', { name: /^Workspace/ })).toBeNull();
    expect(within(rail).queryByRole('button', { name: 'Tools' })).toBeNull();
    expect(within(rail).getByRole('button', { name: 'App' })).toBeDefined();
    expect(within(rail).getByRole('button', { name: 'Providers & models' })).toBeDefined();
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
      within(screen.getByRole('navigation', { name: /settings scopes/i })).getByRole('list', {
        name: 'Providers & models settings',
      }),
    ).toBeDefined();
    expect(screen.getAllByRole('navigation')).toHaveLength(1);
  });

  it('keeps one rail mounted across scopes, with the App list always open', () => {
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
    expect(within(rail).getByRole('list', { name: 'Providers & models settings' })).toBeDefined();
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
    expect(within(rail).queryByRole('list', { name: 'Providers & models settings' })).toBeNull();
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
        within(flagged).getByRole('button', { name: /^Providers & models/ }).textContent,
      ).toContain('Claude CLI needs an update');
    } finally {
      state.updaterStatus = 'idle';
      state.providers = [];
    }
  });

  it('reports rail clicks as focus changes instead of switching on its own', () => {
    const onScopeChange = vi.fn();
    renderApp({ onScopeChange });

    fireEvent.click(screen.getByRole('button', { name: 'Providers & models' }));
    fireEvent.click(screen.getByRole('button', { name: 'Storage' }));

    expect(onScopeChange).toHaveBeenNthCalledWith(1, { scope: 'providers' });
    expect(onScopeChange).toHaveBeenNthCalledWith(2, { scope: 'app', section: 'storage' });
    expect(screen.getByRole('heading', { name: 'General' })).toBeDefined();
  });

  it('opens the shortcuts item with the whole list visible', () => {
    renderApp({ section: 'shortcuts' });

    expect(screen.getByRole('heading', { name: 'Shortcuts' })).toBeDefined();
    expect(screen.getByText(`${SHORTCUT_ROW_COUNT} shortcuts`)).toBeDefined();
    expect(screen.getByText('Command palette')).toBeDefined();
    expect(screen.getByText(shortcutGlyphs('lens.agents'))).toBeDefined();
    expect(screen.queryByRole('button', { name: /keyboard shortcuts/i })).toBeNull();
  });

  it('groups shortcuts by task and folds the workspace digits into one row', () => {
    renderApp({ section: 'shortcuts' });

    for (const group of ['General', 'Workspaces', 'Navigate', 'Session', 'Views', 'Window']) {
      expect(screen.getByRole('heading', { name: group })).toBeDefined();
    }
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

  it('leaves GitHub to Tools settings', () => {
    renderApp();

    expect(screen.queryByText('GitHub')).toBeNull();
    expect(screen.queryByText('Global fallback token used by every workspace.')).toBeNull();
  });

  it('wipes only after the row confirm and offers a restart', async () => {
    renderApp({ section: 'danger' });

    fireEvent.click(screen.getByRole('button', { name: 'Wipe' }));
    expect(state.wipeLocalDatabase).not.toHaveBeenCalled();

    const confirm = screen.getByRole('group', { name: 'Wipe every workspace, session and rule?' });
    fireEvent.click(within(confirm).getByRole('button', { name: 'Wipe' }));
    await waitFor(() => expect(state.wipeLocalDatabase).toHaveBeenCalledOnce());

    expect(await screen.findByText('Local data wiped.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Restart now' }));
    expect(state.relaunchApp).toHaveBeenCalledOnce();
  });

  it('cancels the wipe back to its trigger', () => {
    renderApp({ section: 'danger' });

    fireEvent.click(screen.getByRole('button', { name: 'Wipe' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(state.wipeLocalDatabase).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Wipe' })).toBeDefined();
  });

  it('opens the report issue studio through the shared studio event', () => {
    const listener = vi.fn();
    window.addEventListener(REPORT_ISSUE_STUDIO_EVENT, listener);
    renderApp({ section: 'help' });

    fireEvent.click(screen.getByRole('button', { name: /report an issue/i }));

    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener(REPORT_ISSUE_STUDIO_EVENT, listener);
  });

  it('offers export and import under Backup', () => {
    renderApp({ section: 'backup' });

    expect(screen.getByRole('heading', { name: 'Backup' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Export' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Import' })).toBeDefined();
  });
});
