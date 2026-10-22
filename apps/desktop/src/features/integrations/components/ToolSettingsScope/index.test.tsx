import { invoke } from '@tauri-apps/api/core';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { create } from 'zustand';
import type {
  IntegrationBinding,
  IntegrationBindingId,
  IntegrationCredentialId,
  IsoDateTime,
  WorkspaceId,
} from '@goodboy/types';
import { ToolSettingsScope } from '.';
import type { IntegrationGlyphProvider } from '../IntegrationGlyph';
import type { ScopeFrameParts } from '../../../settings/components/SettingsStudio/types';

const plainFrame = ({ detail }: ScopeFrameParts) => <>{detail}</>;

const WORKSPACE_ID = 'workspace-1' as WorkspaceId;
const LINEAR: IntegrationBinding = {
  id: 'binding-1' as IntegrationBindingId,
  workspaceId: WORKSPACE_ID,
  projectId: null,
  credentialId: 'credential-1' as IntegrationCredentialId,
  createdAt: '2026-09-01' as IsoDateTime,
  updatedAt: '2026-09-01' as IsoDateTime,
  provider: 'linear',
  config: { viewerName: 'Ada', viewerUserId: 'ada', workspaceUrlKey: 'acme' },
};

const BINDINGS = [
  LINEAR,
  {
    ...LINEAR,
    provider: 'gitlab',
    config: { userName: 'Ada', userId: 'ada', host: 'https://gitlab.com' },
  },
  {
    ...LINEAR,
    provider: 'bitbucket',
    config: { email: 'ada@example.com', displayName: 'Ada', workspaceSlug: 'acme' },
  },
  {
    ...LINEAR,
    provider: 'jira',
    config: {
      email: 'ada@example.com',
      displayName: 'Ada',
      siteUrl: 'https://acme.atlassian.net',
      projectKey: 'ENG',
    },
  },
  {
    ...LINEAR,
    provider: 'sentry',
    config: { org: 'acme', project: 'desktop', projectName: 'Desktop' },
  },
  {
    ...LINEAR,
    provider: 'slack',
    config: {
      teamName: 'Acme',
      teamId: 'acme',
      userId: 'ada',
      userName: 'Ada',
      followedChannels: [],
      hasSelectedChannels: true,
      includePrivate: false,
      agentPolicy: {
        readFollowed: 'allow',
        readOthers: 'off',
        reply: 'ask',
        react: 'allow',
      },
      signature: { agents: true, own: false, text: 'Written with Goodboy' },
    },
  },
] satisfies ReadonlyArray<IntegrationBinding>;

const openHeaderMenu = ({ title }: { readonly title: string }) => {
  fireEvent.click(screen.getByRole('button', { name: `More ${title} actions` }));
};

const github = vi.hoisted(() => ({ mode: 'absent', scoped: false, user: null as string | null }));

type GithubStatusMap = Record<string, unknown>;

type GithubWriteParams = {
  readonly workspaceId: WorkspaceId | null;
};

const readGithubStatus = async ({ workspaceId }: GithubWriteParams): Promise<void> => {
  if (workspaceId === null) {
    return;
  }
  const status = await invoke('gh_status', { workspaceId }).catch(() => null);
  store.setState((state) => ({
    githubWorkspaceStatus: { ...state.githubWorkspaceStatus, [workspaceId]: status },
  }));
};

const readGlobalGithubStatus = async (): Promise<void> => {
  const status = await invoke('gh_status', {});
  store.setState({
    githubStatus: github.scoped ? { mode: 'absent', available: true, scopes: [] } : status,
  });
};

const store = create(() => ({
  currentWorkspaceId: WORKSPACE_ID,
  githubStatus: null as unknown,
  refreshGithubStatus: readGlobalGithubStatus,
  githubWorkspaceStatus: {} as GithubStatusMap,
  refreshGithubConnection: readGithubStatus,
  setGithubToken: async ({
    token,
    workspaceId,
  }: GithubWriteParams & { readonly token: string }) => {
    await invoke('gh_set_token', { token, workspaceId });
    await readGithubStatus({ workspaceId });
  },
  clearGithubToken: async ({ workspaceId }: GithubWriteParams) => {
    await invoke('gh_clear_token', { workspaceId });
    await readGithubStatus({ workspaceId });
  },
  workspaceIntegrations: {} as Record<string, ReadonlyArray<IntegrationBinding>>,
  integrationCredentials: [],
  integrationCredentialUsage: {},
  forgetIntegrationCredential: vi.fn(),
  disconnectIntegration: vi.fn(async () => undefined),
  connectLinear: vi.fn(async () => undefined),
  projects: [],
  projectSentryLinks: {},
  loadProjectSentryLinks: vi.fn(async () => undefined),
  linkSentryProject: vi.fn(async () => undefined),
  unlinkSentryProject: vi.fn(async () => undefined),
  slackChannels: {} as Record<string, { channels: ReadonlyArray<unknown> }>,
  refreshSlackChannels: vi.fn(async () => undefined),
  updateSlackConfig: vi.fn(async () => undefined),
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: [],
  useAppStore: Object.assign(
    <T,>(selector: (state: ReturnType<typeof store.getState>) => T) => store(selector),
    {
      getState: () => store.getState(),
      subscribe: (listener: () => void) => store.subscribe(listener),
    },
  ),
}));

const keychain = vi.hoisted(() => ({ hasSecret: true }));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async (command: string) => {
    if (command === 'gh_status') {
      return { ...github, available: true };
    }
    if (command === 'integration_credential_has_secret') {
      return keychain.hasSecret;
    }
    return true;
  }),
}));

beforeEach(() => {
  keychain.hasSecret = true;
  github.mode = 'absent';
  github.scoped = false;
  github.user = null;
  vi.mocked(invoke).mockClear();
  store.setState({ workspaceIntegrations: {}, githubWorkspaceStatus: {}, githubStatus: null });
  store.getState().connectLinear.mockReset();
  store.getState().disconnectIntegration.mockReset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ToolSettingsScope', () => {
  it.each([
    { tool: 'linear', label: 'Linear', field: 'API key', id: 'linear-api-key' },
    { tool: 'jira', label: 'Jira', field: 'Site', id: 'jira-site' },
    { tool: 'gitlab', label: 'GitLab', field: 'Personal API key', id: 'gitlab-pat' },
    { tool: 'bitbucket', label: 'Bitbucket', field: 'Personal API key', id: 'bitbucket-token' },
    { tool: 'sentry', label: 'Sentry', field: 'Auth token', id: 'sentry-token' },
    { tool: 'slack', label: 'Slack', field: 'User token', id: 'slack-token' },
  ] satisfies ReadonlyArray<{
    tool: IntegrationGlyphProvider;
    label: string;
    field: string;
    id: string;
  }>)('focuses the $tool form when the rail opens it', async ({ tool, label, field, id }) => {
    const view = await act(async () =>
      render(<ToolSettingsScope frame={plainFrame} workspaceId={WORKSPACE_ID} />),
    );
    await act(async () => {
      view.rerender(
        <ToolSettingsScope frame={plainFrame} workspaceId={WORKSPACE_ID} initialFocus={tool} />,
      );
    });
    expect(screen.getByLabelText(field).id).toBe(id);
    expect(screen.getByLabelText(field)).toBe(document.activeElement);
    expect(screen.getAllByRole('heading').map((heading) => heading.textContent)).toEqual([label]);
  });

  it('lands initialFocus on the requested tool', async () => {
    await act(async () => {
      render(
        <ToolSettingsScope frame={plainFrame} workspaceId={WORKSPACE_ID} initialFocus="slack" />,
      );
    });
    expect(screen.getByLabelText('User token')).toBeDefined();
  });

  it('shows the connected identity and confirms disconnect', async () => {
    store.setState({ workspaceIntegrations: { [WORKSPACE_ID]: [LINEAR] } });
    await act(async () => {
      render(
        <ToolSettingsScope frame={plainFrame} workspaceId={WORKSPACE_ID} initialFocus="linear" />,
      );
    });
    expect(screen.getByText('Connected as Ada')).toBeDefined();
    expect(screen.getByText('linear.app/acme')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Disconnect Linear' })).toBeNull();
    openHeaderMenu({ title: 'Linear' });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Disconnect' }));
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Disconnect Linear?' })).getByRole('button', {
        name: 'Disconnect Linear',
      }),
    );
    await waitFor(() =>
      expect(store.getState().disconnectIntegration).toHaveBeenCalledWith({
        workspaceId: WORKSPACE_ID,
        provider: 'linear',
      }),
    );
  });

  it('flips the form to the connected view when connecting updates the binding', async () => {
    store.getState().connectLinear.mockImplementation(async () => {
      store.setState({ workspaceIntegrations: { [WORKSPACE_ID]: [LINEAR] } });
    });
    await act(async () => {
      render(
        <ToolSettingsScope frame={plainFrame} workspaceId={WORKSPACE_ID} initialFocus="linear" />,
      );
    });
    fireEvent.change(screen.getByLabelText('API key'), { target: { value: 'test-key' } });
    await waitFor(() => expect(screen.getByText('Connected as Ada')).toBeDefined(), {
      timeout: 2000,
    });
    expect(screen.queryByLabelText('API key')).toBeNull();
    openHeaderMenu({ title: 'Linear' });
    expect(screen.getByRole('menuitem', { name: 'Open in Tasks' })).toBeDefined();
  });

  it('opens connected tools in Tasks', async () => {
    store.setState({ workspaceIntegrations: { [WORKSPACE_ID]: [LINEAR] } });
    const dispatch = vi.spyOn(window, 'dispatchEvent');
    await act(async () => {
      render(
        <ToolSettingsScope frame={plainFrame} workspaceId={WORKSPACE_ID} initialFocus="linear" />,
      );
    });
    openHeaderMenu({ title: 'Linear' });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Open in Tasks' }));
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'goodboy:open-inbox', detail: { provider: 'linear' } }),
    );
  });

  it('says the key is missing in a notice and a chip, with the one Disconnect', async () => {
    keychain.hasSecret = false;
    store.setState({ workspaceIntegrations: { [WORKSPACE_ID]: [LINEAR] } });
    await act(async () => {
      render(
        <ToolSettingsScope frame={plainFrame} workspaceId={WORKSPACE_ID} initialFocus="linear" />,
      );
    });

    expect(await screen.findByText('The Linear key is missing from this Mac')).toBeDefined();
    expect(screen.getByText('Key missing')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Disconnect Linear?' })).getByRole('button', {
        name: 'Disconnect Linear',
      }),
    );
    await waitFor(() =>
      expect(store.getState().disconnectIntegration).toHaveBeenCalledWith({
        workspaceId: WORKSPACE_ID,
        provider: 'linear',
      }),
    );
  });

  it('stays quiet about the key while it is in the keychain', async () => {
    store.setState({ workspaceIntegrations: { [WORKSPACE_ID]: [LINEAR] } });
    await act(async () => {
      render(
        <ToolSettingsScope frame={plainFrame} workspaceId={WORKSPACE_ID} initialFocus="linear" />,
      );
    });

    expect(screen.queryByText('Key missing')).toBeNull();
    expect(screen.queryByText('The Linear key is missing from this Mac')).toBeNull();
  });

  it('checks the key again from the header menu', async () => {
    store.setState({ workspaceIntegrations: { [WORKSPACE_ID]: [LINEAR] } });
    await act(async () => {
      render(
        <ToolSettingsScope frame={plainFrame} workspaceId={WORKSPACE_ID} initialFocus="linear" />,
      );
    });
    expect(screen.queryByText('Key missing')).toBeNull();

    keychain.hasSecret = false;
    openHeaderMenu({ title: 'Linear' });
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Check again' }));
    });

    expect(await screen.findByText('Key missing')).toBeDefined();
  });

  it('offers GitHub Open in Tasks and Check again but leaves Disconnect to its account rows', async () => {
    github.mode = 'gh-cli';
    github.user = 'Ada';
    await act(async () => {
      render(
        <ToolSettingsScope frame={plainFrame} workspaceId={WORKSPACE_ID} initialFocus="github" />,
      );
    });
    await screen.findByText('Connected as Ada through the gh CLI');
    openHeaderMenu({ title: 'GitHub' });

    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Open in Tasks',
      'Check again',
    ]);
  });

  it.each([
    {
      provider: 'gitlab',
      identity: 'Connected as Ada',
      secondary: 'https://gitlab.com',
      label: 'GitLab',
    },
    {
      provider: 'bitbucket',
      identity: 'Connected as Ada',
      secondary: 'bitbucket.org/acme',
      label: 'Bitbucket',
    },
    {
      provider: 'jira',
      identity: 'Connected as Ada',
      secondary: 'https://acme.atlassian.net (ENG)',
      label: 'Jira',
    },
    {
      provider: 'sentry',
      identity: 'Connected to Desktop',
      secondary: 'acme/desktop',
      label: 'Sentry',
    },
    { provider: 'slack', identity: 'Connected as Ada', secondary: 'Acme', label: 'Slack' },
  ] satisfies ReadonlyArray<{
    provider: 'gitlab' | 'bitbucket' | 'jira' | 'sentry' | 'slack';
    identity: string;
    secondary: string;
    label: string;
  }>)(
    'preserves $provider identity and disconnect behavior',
    async ({ provider, identity, secondary, label }) => {
      store.setState({ workspaceIntegrations: { [WORKSPACE_ID]: BINDINGS } });
      await act(async () => {
        render(
          <ToolSettingsScope
            frame={plainFrame}
            workspaceId={WORKSPACE_ID}
            initialFocus={provider}
          />,
        );
      });
      expect(screen.getAllByRole('heading').map((heading) => heading.textContent)).toEqual([label]);
      expect(screen.getByText(identity)).toBeDefined();
      expect(screen.getAllByText(secondary).length).toBeGreaterThan(0);
      openHeaderMenu({ title: label });
      fireEvent.click(screen.getByRole('menuitem', { name: 'Disconnect' }));
      fireEvent.click(
        within(screen.getByRole('group', { name: `Disconnect ${label}?` })).getByRole('button', {
          name: `Disconnect ${label}`,
        }),
      );
      await waitFor(() =>
        expect(store.getState().disconnectIntegration).toHaveBeenCalledWith({
          workspaceId: WORKSPACE_ID,
          provider,
        }),
      );
    },
  );

  it('defaults to the first unconnected tool after GitHub resolves and names it once', async () => {
    github.mode = 'gh-cli';
    github.user = 'Ada';
    const onDefaultTool = vi.fn();
    await act(async () => {
      render(
        <ToolSettingsScope
          frame={plainFrame}
          workspaceId={WORKSPACE_ID}
          onDefaultTool={onDefaultTool}
        />,
      );
    });
    await waitFor(() => expect(screen.getByLabelText('Personal API key').id).toBe('gitlab-pat'));
    expect(onDefaultTool.mock.calls).toEqual([[{ tool: 'gitlab' }]]);
  });

  it.each([undefined, 'linear'] satisfies ReadonlyArray<'linear' | undefined>)(
    'holds the detail empty until GitHub resolves with initial focus %s',
    async (initialFocus) => {
      let resolveStatus: (status: unknown) => void = () => undefined;
      vi.mocked(invoke).mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveStatus = resolve;
          }),
      );
      render(
        <ToolSettingsScope
          frame={plainFrame}
          workspaceId={WORKSPACE_ID}
          initialFocus={initialFocus}
        />,
      );
      expect(screen.queryByRole('heading')).toBeNull();
      expect(screen.queryByLabelText('Personal API key')).toBeNull();
      expect(screen.queryByLabelText('API key')).toBeNull();
      await act(async () => resolveStatus({ mode: 'gh-cli', user: 'Ada', scoped: false }));
      const field =
        initialFocus === 'linear'
          ? screen.getByLabelText('API key')
          : screen.getByLabelText('Personal API key');
      expect(field.id).toBe(initialFocus === 'linear' ? 'linear-api-key' : 'gitlab-pat');
      expect(field).toBe(document.activeElement);
    },
  );

  it('keeps one title and switches its subtitle when the connection changes', async () => {
    await act(async () => {
      render(
        <ToolSettingsScope frame={plainFrame} workspaceId={WORKSPACE_ID} initialFocus="linear" />,
      );
    });
    const title = screen.getByRole('heading', { name: 'Linear' });
    const header = title.parentElement?.parentElement ?? null;
    expect(header?.textContent).toBe('LinearConnect Linear');
    expect(screen.getAllByRole('heading')).toHaveLength(1);
    act(() => store.setState({ workspaceIntegrations: { [WORKSPACE_ID]: [LINEAR] } }));
    expect(header?.textContent).toBe('LinearAda · acme');
    expect(screen.getAllByRole('heading')).toHaveLength(1);
  });

  it('connects GitHub with a workspace key without requiring the CLI', async () => {
    await act(async () => {
      render(
        <ToolSettingsScope frame={plainFrame} workspaceId={WORKSPACE_ID} initialFocus="github" />,
      );
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Use a different key' }));
    const field = document.getElementById('github-workspace-pat');
    if (field === null) {
      throw new Error('the workspace key field did not open');
    }
    fireEvent.change(field, { target: { value: 'test-key' } });
    github.mode = 'pat';
    github.user = 'Ada';
    github.scoped = true;
    const form = field.closest('form');
    if (form === null) {
      throw new Error('the workspace key field sits outside a form');
    }
    fireEvent.click(within(form).getByRole('button', { name: 'Connect' }));
    expect(await screen.findByText('workspace key')).toBeDefined();
    expect(invoke).toHaveBeenCalledWith('gh_set_token', {
      token: 'test-key',
      workspaceId: WORKSPACE_ID,
    });
    expect(screen.getByText('Connected as Ada')).toBeDefined();
    expect(document.getElementById('github-workspace-pat')).toBeNull();
    expect(screen.getAllByRole('heading').map((heading) => heading.textContent)).toEqual([
      'GitHub',
    ]);
  });

  it('names a global GitHub key on the all workspaces row, with its own disconnect', async () => {
    github.mode = 'pat';
    github.user = 'Ada';
    await act(async () => {
      render(
        <ToolSettingsScope frame={plainFrame} workspaceId={WORKSPACE_ID} initialFocus="github" />,
      );
    });
    expect(await screen.findByText('Connected as Ada with a personal API key')).toBeDefined();
    expect(screen.getByText('Uses the all-workspaces connection')).toBeDefined();
    expect(screen.queryByLabelText('Personal API key')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect GitHub' }));
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Disconnect GitHub' }),
    );
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith('gh_clear_token', { workspaceId: null }),
    );
  });

  it('defaults to the first tool when every tool is connected', async () => {
    github.mode = 'gh-cli';
    github.user = 'Ada';
    store.setState({ workspaceIntegrations: { [WORKSPACE_ID]: BINDINGS } });
    await act(async () => {
      render(<ToolSettingsScope frame={plainFrame} workspaceId={WORKSPACE_ID} />);
    });
    expect(await screen.findByText('Connected as Ada through the gh CLI')).toBeDefined();
    expect(screen.getByText('Run gh auth logout to sign out')).toBeDefined();
    expect(screen.getByRole('heading', { name: 'GitHub' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Disconnect GitHub' })).toBeNull();
    expect(screen.queryByLabelText('Personal API key')).toBeNull();
  });

  it('offers CLI instructions and refreshes the GitHub connection', async () => {
    await act(async () => {
      render(
        <ToolSettingsScope frame={plainFrame} workspaceId={WORKSPACE_ID} initialFocus="github" />,
      );
    });
    expect(await screen.findByText('gh auth login')).toBeDefined();
    expect(screen.getByLabelText('Personal API key').id).toBe('github-pat');
    github.mode = 'gh-cli';
    github.user = 'Ada';
    fireEvent.click(screen.getByRole('button', { name: 'Check the GitHub connection' }));
    expect(await screen.findByText('Connected as Ada through the gh CLI')).toBeDefined();
  });

  it('says so in one line when the gh CLI is missing', async () => {
    store.setState({ githubStatus: { mode: 'absent', available: false, scopes: [] } });
    await act(async () => {
      render(
        <ToolSettingsScope frame={plainFrame} workspaceId={WORKSPACE_ID} initialFocus="github" />,
      );
    });
    expect(await screen.findByText('The GitHub CLI is not installed.')).toBeDefined();
    expect(screen.queryByLabelText('Personal API key')).toBeNull();
  });

  it('preserves the existing scoped GitHub disconnect action', async () => {
    github.mode = 'pat';
    github.scoped = true;
    github.user = 'Ada';
    await act(async () => {
      render(
        <ToolSettingsScope frame={plainFrame} workspaceId={WORKSPACE_ID} initialFocus="github" />,
      );
    });
    expect(await screen.findByText('Connected as Ada')).toBeDefined();
    expect(screen.getByText('workspace key')).toBeDefined();
    expect(screen.getAllByRole('button', { name: 'Disconnect GitHub' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect GitHub' }));
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Disconnect GitHub' }),
    );
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith('gh_clear_token', { workspaceId: WORKSPACE_ID }),
    );
  });

  it('reads the global and the workspace status once each', async () => {
    await act(async () => {
      render(
        <ToolSettingsScope frame={plainFrame} workspaceId={WORKSPACE_ID} initialFocus="github" />,
      );
    });
    expect(screen.getByLabelText('Personal API key')).toBeDefined();
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(invoke).toHaveBeenCalledWith('gh_status', { workspaceId: WORKSPACE_ID });
    expect(invoke).toHaveBeenCalledWith('gh_status', {});
  });
});
