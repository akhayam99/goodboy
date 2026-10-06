// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../../store/storyHarness')).dbLibModuleMock(),
);

import type { ComponentProps } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IsoDateTime, ProviderConnectionState, ProviderId, WorkspaceId } from '@goodboy/types';
import { aWorkspace } from '@goodboy/types/testing';
import type { ProviderDisplayInfo } from '../../../features/providers/providers';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../store/storyHarness';
import {
  integrationLabel,
  type IntegrationGlyphProvider,
} from '../../../features/integrations/components/IntegrationGlyph';
import { FOOTER_INTEGRATIONS } from './categories';
import { footerTarget, type ConnectedIntegrations } from '../../hooks/useAppOverlays/overlayState';
import type { StudioPlace } from '../../../store';

vi.mock('../GoodboyChip', () => ({
  GoodboyChip: ({
    onOpenChangelog,
    onOpenShortcuts,
  }: {
    readonly onOpenChangelog: () => void;
    readonly onOpenShortcuts: () => void;
  }) => (
    <span data-testid="goodboy-chip">
      <button type="button" onClick={onOpenChangelog}>
        Chip changelog
      </button>
      <button type="button" onClick={onOpenShortcuts}>
        Chip shortcuts
      </button>
    </span>
  ),
}));

const WORKSPACE = aWorkspace({ id: 'workspace-harborline' as WorkspaceId, name: 'Harborline' });

type ProviderParams = {
  readonly id: ProviderId;
  readonly connection: ProviderConnectionState;
};

const providerInfo = ({ id, connection }: ProviderParams): ProviderDisplayInfo => ({
  id,
  binary: id,
  capabilities: { models: [], supportsTools: true, supportsStream: true, supportsCheapModel: true },
  connection,
  version: null,
  identity: null,
  label: id,
  error: null,
  docsUrl: '',
});

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({
    workspaces: [WORKSPACE],
    currentWorkspaceId: WORKSPACE.id,
    providers: [
      providerInfo({ id: 'anthropic', connection: 'connected' }),
      providerInfo({ id: 'codex', connection: 'connected' }),
      providerInfo({ id: 'opencode', connection: 'installed_disconnected' }),
    ],
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

import { AppFooter } from './index';

const SETTINGS_LABEL = 'Settings';

const footerRow = () => screen.getByTestId('goodboy-chip').closest('.grid');

type FooterProps = ComponentProps<typeof AppFooter>;

type Params = {
  readonly overrides?: Partial<FooterProps>;
};

const NONE_CONNECTED: ConnectedIntegrations = {
  github: false,
  gitlab: false,
  bitbucket: false,
  linear: false,
  jira: false,
  sentry: false,
  slack: false,
};

const ALL_CONNECTED: ConnectedIntegrations = {
  github: true,
  gitlab: true,
  bitbucket: true,
  linear: true,
  jira: true,
  sentry: true,
  slack: true,
};

const connectedWith = (
  providers: ReadonlyArray<IntegrationGlyphProvider>,
): ConnectedIntegrations => ({
  ...NONE_CONNECTED,
  ...Object.fromEntries(providers.map((provider) => [provider, true])),
});

type TargetParams = {
  readonly overlay: StudioPlace;
  readonly connected?: ConnectedIntegrations;
};

const targetFor = ({ overlay, connected = NONE_CONNECTED }: TargetParams) =>
  footerTarget({ overlay, connected });

const footerProps = ({ overrides = {} }: Params = {}): FooterProps => ({
  scope: 'workspace',
  target: { place: null, tool: null },
  connected: NONE_CONNECTED,
  onOpenIntegration: vi.fn(),
  onOpenInbox: vi.fn(),
  onOpenWorkflows: vi.fn(),
  onOpenImpact: vi.fn(),
  onOpenSettings: vi.fn(),
  onOpenChangelog: vi.fn(),
  onOpenShortcuts: vi.fn(),
  ...overrides,
});

const rightNames = () =>
  Array.from(footerRow()?.children[2]?.querySelectorAll('button') ?? []).map(
    (button) => button.getAttribute('aria-label') ?? button.textContent,
  );

describe('AppFooter', () => {
  it('keeps inbox, workflows, impact, providers and settings on the right, in that order', () => {
    const onOpenInbox = vi.fn();
    const onOpenWorkflows = vi.fn();
    const onOpenImpact = vi.fn();
    const onOpenSettings = vi.fn();
    render(
      <AppFooter
        {...footerProps({
          overrides: { onOpenInbox, onOpenWorkflows, onOpenImpact, onOpenSettings },
        })}
      />,
    );

    expect(rightNames()).toEqual(['Inbox', 'Workflows', 'Impact', 'Providers', SETTINGS_LABEL]);

    fireEvent.click(screen.getByRole('button', { name: 'Inbox' }));
    fireEvent.click(screen.getByRole('button', { name: 'Workflows' }));
    fireEvent.click(screen.getByRole('button', { name: 'Impact' }));
    fireEvent.click(screen.getByRole('button', { name: SETTINGS_LABEL }));

    expect(onOpenInbox).toHaveBeenCalledOnce();
    expect(onOpenWorkflows).toHaveBeenCalledOnce();
    expect(onOpenImpact).toHaveBeenCalledOnce();
    expect(onOpenSettings).toHaveBeenCalledOnce();
  });

  it('opens the providers menu on the cached providers, with the workspace order below', () => {
    const refreshProviders = vi.fn(async () => undefined);
    useAppStore.setState({ refreshProviders });
    render(<AppFooter {...footerProps()} />);
    storySpies.tauriInvoke.mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'Providers' }));

    const menu = screen.getByRole('dialog', { name: 'Providers' });
    within(menu).getByText('This workspace');
    expect(within(menu).queryByText(/Harborline/)).toBeNull();
    within(menu).getByRole('list', { name: 'Providers, in order, for this workspace' });
    within(menu).getByRole('button', { name: /Connect OpenCode/ });
    within(menu).getByRole('button', { name: /Manage providers/ });
    expect(refreshProviders).not.toHaveBeenCalled();
    expect(storySpies.tauriInvoke).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /^More pages/ })).toBeNull();
  });

  it('keeps the limit meters out of the menu, which is policy and links only', () => {
    useAppStore.setState({
      providerLimits: {
        anthropic: {
          providerId: 'anthropic',
          plan: 'max',
          status: 'ok',
          windows: [
            {
              kind: 'fiveHour',
              model: null,
              status: 'ok',
              usedFraction: 0.42,
              resetsAt: new Date(Date.now() + 3_600_000).toISOString() as IsoDateTime,
            },
          ],
          observedAt: new Date().toISOString() as IsoDateTime,
        },
      },
    });
    render(<AppFooter {...footerProps()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Providers' }));

    const menu = screen.getByRole('dialog', { name: 'Providers' });
    expect(within(menu).queryByRole('list', { name: 'Provider limits' })).toBeNull();
    expect(within(menu).queryByText(/42/)).toBeNull();
    expect(within(menu).queryByText(/\b5h\b/)).toBeNull();
  });

  it('pulses the providers button while no provider is connected', () => {
    useAppStore.setState({
      providers: [providerInfo({ id: 'anthropic', connection: 'installed_disconnected' })],
    });
    render(<AppFooter {...footerProps()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Providers, none connected' }));

    const menu = screen.getByRole('dialog', { name: 'Providers' });
    within(menu).getByText('No provider is connected yet.');
    expect(within(menu).queryByRole('list', { name: /Providers, in order/ })).toBeNull();
  });

  it('offers a Connect row per provider and no usage figure with none connected', () => {
    useAppStore.setState({
      providers: [
        providerInfo({ id: 'anthropic', connection: 'installed_disconnected' }),
        providerInfo({ id: 'codex', connection: 'missing' }),
      ],
      providerLimits: {},
    });
    const { container } = render(<AppFooter {...footerProps()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Providers, none connected' }));

    const menu = screen.getByRole('dialog', { name: 'Providers' });
    within(menu).getByRole('button', { name: /Connect Claude/ });
    within(menu).getByRole('button', { name: /Connect Codex/ });
    within(menu).getByRole('button', { name: /Manage providers/ });
    expect(container.textContent).not.toMatch(/\d+\s?%/);
    expect(menu.textContent).not.toMatch(/\d+\s?%/);
  });

  it('sends Manage providers to the providers home as a door and closes the menu', () => {
    const listener = vi.fn();
    window.addEventListener('goodboy:open-settings', listener);
    render(<AppFooter {...footerProps()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Providers' }));
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Providers' })).getByRole('button', {
        name: /Manage providers/,
      }),
    );
    window.removeEventListener('goodboy:open-settings', listener);

    const event = listener.mock.calls[0]?.[0] as CustomEvent;
    expect(event.detail).toMatchObject({ scope: 'providers', door: true });
    expect(screen.queryByRole('dialog', { name: 'Providers' })).toBeNull();
  });

  it('seats the Goodboy chip in the centre and hands it changelog and shortcuts', () => {
    const onOpenChangelog = vi.fn();
    const onOpenShortcuts = vi.fn();
    render(<AppFooter {...footerProps({ overrides: { onOpenChangelog, onOpenShortcuts } })} />);

    expect(footerRow()?.children[1]?.contains(screen.getByTestId('goodboy-chip'))).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Chip changelog' }));
    fireEvent.click(screen.getByRole('button', { name: 'Chip shortcuts' }));

    expect(onOpenChangelog).toHaveBeenCalledOnce();
    expect(onOpenShortcuts).toHaveBeenCalledOnce();
  });

  it('keeps only settings and the Goodboy chip without a workspace', () => {
    render(
      <AppFooter
        {...footerProps({ overrides: { scope: 'app', connected: connectedWith(['github']) } })}
      />,
    );

    expect(rightNames()).toEqual([SETTINGS_LABEL]);
    expect(screen.queryByRole('group', { name: 'Connected integrations' })).toBeNull();
    expect(footerRow()?.children[1]?.contains(screen.getByTestId('goodboy-chip'))).toBe(true);
  });

  it('lights settings while the providers scope is open', () => {
    render(
      <AppFooter
        {...footerProps({
          overrides: {
            target: targetFor({ overlay: { kind: 'settings', focus: { scope: 'providers' } } }),
          },
        })}
      />,
    );

    expect(screen.getByRole('button', { name: SETTINGS_LABEL }).getAttribute('aria-current')).toBe(
      'page',
    );
  });

  it('lays the row out as three grid regions so the chip cannot overlap a cluster', () => {
    render(<AppFooter {...footerProps()} />);

    const row = footerRow();

    expect(row?.className).toContain('grid');
    expect(row?.className).toContain('grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]');
    expect(row?.className).toContain('bg-chrome');
    expect(screen.getByTestId('goodboy-chip').className).not.toContain('absolute');
    expect(row?.children.length).toBe(3);
  });

  it('marks only the open studio button as the current page', () => {
    render(
      <AppFooter
        {...footerProps({ overrides: { target: targetFor({ overlay: { kind: 'workflow' } }) } })}
      />,
    );

    const settings = screen.getByRole('button', { name: SETTINGS_LABEL });
    const workflows = screen.getByRole('button', { name: 'Workflows' });

    expect(settings.getAttribute('aria-current')).toBeNull();
    expect(workflows.getAttribute('aria-current')).toBe('page');
  });

  it('marks settings as the current page while its studio is open', () => {
    render(
      <AppFooter
        {...footerProps({
          overrides: {
            target: targetFor({ overlay: { kind: 'settings', focus: { scope: 'app' } } }),
          },
        })}
      />,
    );

    const settings = screen.getByRole('button', { name: SETTINGS_LABEL });

    expect(settings.getAttribute('aria-current')).toBe('page');
  });

  it('invites the first connection when the workspace has none', () => {
    render(<AppFooter {...footerProps()} />);

    expect(screen.getByRole('group', { name: 'Connected integrations' }).children.length).toBe(0);
    expect(screen.getByRole('button', { name: 'Connect your first integration' })).toBeDefined();
  });

  it('renders a few connected integrations as named glyphs that open their studios', () => {
    const onOpenIntegration = vi.fn();
    render(
      <AppFooter
        {...footerProps({
          overrides: { connected: connectedWith(['github', 'linear']), onOpenIntegration },
        })}
      />,
    );

    const connected = screen.getByRole('group', { name: 'Connected integrations' });
    const github = within(connected).getByRole('button', { name: 'GitHub' });

    expect(github.textContent).toBe('');
    expect(within(connected).getByRole('button', { name: 'Linear' })).toBeDefined();
    expect(within(connected).getAllByRole('button').length).toBe(2);

    fireEvent.click(github);
    expect(onOpenIntegration).toHaveBeenCalledExactlyOnceWith({ provider: 'github' });
  });

  it('reaches every integration through the single link popover', () => {
    const onOpenIntegration = vi.fn();
    render(
      <AppFooter
        {...footerProps({ overrides: { connected: connectedWith(['github']), onOpenIntegration } })}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Connect GitLab' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Connect an integration' }));

    const panel = screen.getByRole('dialog', { name: 'Integrations' });
    expect(within(panel).getByRole('button', { name: 'Open GitHub' })).toBeDefined();
    expect(within(panel).getByRole('button', { name: 'Connect Bitbucket' })).toBeDefined();

    fireEvent.click(within(panel).getByRole('button', { name: 'Connect GitLab' }));

    expect(onOpenIntegration).toHaveBeenCalledExactlyOnceWith({ provider: 'gitlab' });
    expect(screen.queryByRole('dialog', { name: 'Integrations' })).toBeNull();
  });

  it('names the connection state of every member in the popover', () => {
    render(<AppFooter {...footerProps({ overrides: { connected: connectedWith(['linear']) } })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Connect an integration' }));

    const panel = screen.getByRole('dialog', { name: 'Integrations' });
    expect(within(panel).getAllByRole('listitem').length).toBe(7);
    expect(within(panel).getAllByText('Not connected').length).toBe(6);
    expect(within(panel).getByText('Connected')).toBeDefined();
  });

  it('closes the popover on escape', () => {
    render(<AppFooter {...footerProps()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Connect your first integration' }));
    expect(screen.getByRole('dialog', { name: 'Integrations' })).toBeDefined();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByRole('dialog', { name: 'Integrations' })).toBeNull();
  });

  it('sends every connected glyph to its own provider', () => {
    FOOTER_INTEGRATIONS.forEach((member) => {
      const onOpenIntegration = vi.fn();
      render(
        <AppFooter
          {...footerProps({ overrides: { connected: ALL_CONNECTED, onOpenIntegration } })}
        />,
      );

      fireEvent.click(
        screen.getByRole('button', { name: integrationLabel({ provider: member.provider }) }),
      );

      expect(onOpenIntegration).toHaveBeenCalledExactlyOnceWith({ provider: member.provider });
      cleanup();
    });
  });

  it('sends every unconnected popover row to its own provider', () => {
    FOOTER_INTEGRATIONS.forEach((member) => {
      const onOpenIntegration = vi.fn();
      render(<AppFooter {...footerProps({ overrides: { onOpenIntegration } })} />);
      fireEvent.click(screen.getByRole('button', { name: 'Connect your first integration' }));
      fireEvent.click(
        within(screen.getByRole('dialog', { name: 'Integrations' })).getByRole('button', {
          name: member.connectLabel,
        }),
      );
      expect(onOpenIntegration).toHaveBeenCalledExactlyOnceWith({ provider: member.provider });
      cleanup();
    });
  });

  it('holds the active state on the link action while a disconnected tool form is open', () => {
    const overlay: StudioPlace = { kind: 'settings', focus: { scope: 'tools', tool: 'sentry' } };
    render(<AppFooter {...footerProps({ overrides: { target: targetFor({ overlay }) } })} />);

    expect(
      screen
        .getByRole('button', { name: 'Connect your first integration' })
        .getAttribute('aria-current'),
    ).toBe('page');
  });

  it('marks only the glyph of the tool whose inbox is open', () => {
    const connected = connectedWith(['sentry', 'github']);
    const overlay: StudioPlace = {
      kind: 'inbox',
      focus: { provider: 'sentry', kind: null, recordKey: null, sessionId: null },
    };
    render(
      <AppFooter
        {...footerProps({ overrides: { connected, target: targetFor({ overlay, connected }) } })}
      />,
    );

    expect(screen.getByRole('button', { name: 'Inbox' }).getAttribute('aria-current')).toBeNull();
    expect(screen.getByRole('button', { name: 'Sentry' }).getAttribute('aria-current')).toBe(
      'page',
    );
    expect(screen.getByRole('button', { name: 'GitHub' }).getAttribute('aria-current')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Connect an integration' }).getAttribute('aria-current'),
    ).toBeNull();
  });

  it('lights the inbox alone when the whole inbox is open', () => {
    const connected = connectedWith(['sentry']);
    const overlay: StudioPlace = { kind: 'inbox', focus: null };
    render(
      <AppFooter
        {...footerProps({ overrides: { connected, target: targetFor({ overlay, connected }) } })}
      />,
    );

    expect(screen.getByRole('button', { name: 'Inbox' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('button', { name: 'Sentry' }).getAttribute('aria-current')).toBeNull();
  });

  it('keeps the link action reachable with many connected integrations', () => {
    render(<AppFooter {...footerProps({ overrides: { connected: ALL_CONNECTED } })} />);

    expect(
      within(screen.getByRole('group', { name: 'Connected integrations' })).getAllByRole('button')
        .length,
    ).toBe(7);
    fireEvent.click(screen.getByRole('button', { name: 'Connect an integration' }));
    expect(screen.getByRole('dialog', { name: 'Integrations' })).toBeDefined();
  });

  it('drops words before glyphs at narrow widths and keeps the first link label', () => {
    const { container, unmount } = render(
      <AppFooter {...footerProps({ overrides: { connected: ALL_CONNECTED } })} />,
    );

    expect(container.querySelector('.\\@container\\/footer')).not.toBeNull();
    ['Inbox', 'Workflows', 'Settings', 'Connect an integration'].forEach((word) => {
      expect(screen.getByText(word).className).toContain('@min-chrome-labels/footer:inline');
    });
    unmount();

    render(<AppFooter {...footerProps()} />);
    expect(screen.getByText('Connect an integration').className).not.toContain('hidden');
  });
});
