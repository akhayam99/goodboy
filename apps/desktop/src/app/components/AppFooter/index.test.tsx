import type { ComponentProps } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  integrationLabel,
  type IntegrationGlyphProvider,
} from '../../../features/integrations/components/IntegrationGlyph';
import { FOOTER_INTEGRATIONS } from './categories';
import {
  footerTarget,
  type ConnectedIntegrations,
  type Overlay,
} from '../../hooks/useAppOverlays/overlayState';

const { storeState } = vi.hoisted(() => ({
  storeState: {
    providers: [] as ReadonlyArray<{ readonly connection: string }>,
    updaterStatus: 'idle' as 'idle' | 'available' | 'downloading',
    updateVersion: '0.2.0' as string | null,
    installUpdate: vi.fn(async () => undefined),
    updateFailure: null,
    updateProgress: null,
    agentTurnState: {},
    focusChangelogRelease: vi.fn(),
  },
}));

vi.mock('../../../store', () => ({
  useAppStore: <T,>(selector: (state: typeof storeState) => T) => selector(storeState),
}));

beforeEach(() => {
  storeState.providers = [];
  storeState.updaterStatus = 'idle';
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

import { AppFooter } from './index';
import { shortcutGlyphs } from '../../../shared/keyboard/registry';

const SETTINGS_LABEL = `Open settings (${shortcutGlyphs('settings.open')})`;
const REST_MORE_LABEL = 'More pages: impact and changelog';

const footerRow = () => screen.getByTestId('beta-badge-trigger').closest('.grid');

const openMore = () => {
  fireEvent.click(screen.getByRole('button', { name: /^More pages/ }));
  return screen.getByRole('dialog', { name: 'More pages' });
};

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
  readonly overlay: Overlay;
  readonly connected?: ConnectedIntegrations;
};

const targetFor = ({ overlay, connected = NONE_CONNECTED }: TargetParams) =>
  footerTarget({ overlay, connected });

const footerProps = ({ overrides = {} }: Params = {}): FooterProps => ({
  scope: 'workspace',
  target: null,
  connected: NONE_CONNECTED,
  onOpenIntegration: vi.fn(),
  onOpenInbox: vi.fn(),
  onOpenWorkflows: vi.fn(),
  onOpenProviders: vi.fn(),
  onOpenSettings: vi.fn(),
  onOpenImpact: vi.fn(),
  onOpenChangelog: vi.fn(),
  ...overrides,
});

describe('AppFooter', () => {
  it('keeps inbox, workflows, providers and settings one click away on the right', () => {
    const onOpenInbox = vi.fn();
    const onOpenWorkflows = vi.fn();
    const onOpenProviders = vi.fn();
    const onOpenSettings = vi.fn();
    render(
      <AppFooter
        {...footerProps({
          overrides: { onOpenInbox, onOpenWorkflows, onOpenProviders, onOpenSettings },
        })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open the inbox for this workspace' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Open the workflow library for this workspace' }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Connect and manage your provider accounts' }),
    );
    fireEvent.click(screen.getByRole('button', { name: SETTINGS_LABEL }));

    expect(onOpenInbox).toHaveBeenCalledOnce();
    expect(onOpenWorkflows).toHaveBeenCalledOnce();
    expect(onOpenProviders).toHaveBeenCalledOnce();
    expect(onOpenSettings).toHaveBeenCalledOnce();
    expect(
      screen.queryByRole('button', {
        name: 'See how orchestration changed the way this workspace works, and what it spends',
      }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'See what changed, release by release' }),
    ).toBeNull();
  });

  it('routes impact and changelog through the more menu', () => {
    const onOpenImpact = vi.fn();
    const onOpenChangelog = vi.fn();
    const { rerender } = render(
      <AppFooter {...footerProps({ overrides: { onOpenImpact, onOpenChangelog } })} />,
    );

    const menu = openMore();
    expect(within(menu).getAllByRole('button')).toHaveLength(2);
    expect(within(menu).queryByRole('button', { name: /budget/i })).toBeNull();
    fireEvent.keyDown(window, { key: 'Escape' });

    fireEvent.click(
      within(openMore()).getByRole('button', {
        name: 'See how orchestration changed the way this workspace works, and what it spends',
      }),
    );
    expect(onOpenImpact).toHaveBeenCalledOnce();

    fireEvent.click(
      within(openMore()).getByRole('button', { name: 'See what changed, release by release' }),
    );
    expect(onOpenChangelog).toHaveBeenCalledOnce();

    rerender(
      <AppFooter
        {...footerProps({
          overrides: { target: targetFor({ overlay: { kind: 'impact', scope: null } }) },
        })}
      />,
    );
    expect(screen.getByRole('button', { name: /^More pages/ }).className).toContain(
      'bg-muted text-foreground',
    );
  });

  it('closes the more menu on escape', () => {
    render(<AppFooter {...footerProps()} />);

    openMore();
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByRole('dialog', { name: 'More pages' })).toBeNull();
  });

  it('never dots the more control, release notes announce themselves elsewhere', () => {
    render(<AppFooter {...footerProps()} />);

    expect(screen.queryByTestId('more-studios-dot')).toBeNull();
    expect(screen.getByRole('button', { name: REST_MORE_LABEL })).toBeDefined();
  });

  it('shows the update control only while an update is pending', () => {
    const { rerender } = render(<AppFooter {...footerProps()} />);

    expect(screen.queryByTestId('update-indicator')).toBeNull();

    storeState.updaterStatus = 'available';
    rerender(<AppFooter {...footerProps()} />);

    expect(screen.getByTestId('update-indicator').textContent).toContain('Update to 0.2.0');
  });

  it('orders the right cluster as inbox, workflows, providers, settings, more', () => {
    storeState.updaterStatus = 'available';
    render(<AppFooter {...footerProps()} />);

    const row = footerRow();
    const cluster = row?.children[2];
    const buttons = Array.from(cluster?.querySelectorAll('button') ?? []).filter(
      (button) => button.closest('dialog') == null,
    );
    const names = buttons.map((button) => button.getAttribute('aria-label') ?? button.textContent);

    expect(names).toEqual([
      'Open the inbox for this workspace',
      'Open the workflow library for this workspace',
      'Connect and manage your provider accounts',
      SETTINGS_LABEL,
      REST_MORE_LABEL,
    ]);
  });

  it('keeps only providers, settings and the update control without a workspace', () => {
    storeState.updaterStatus = 'available';
    render(
      <AppFooter
        {...footerProps({ overrides: { scope: 'app', connected: connectedWith(['github']) } })}
      />,
    );

    const row = footerRow();
    const names = Array.from(row?.children[2]?.querySelectorAll('button') ?? []).map(
      (button) => button.getAttribute('aria-label') ?? button.textContent,
    );

    expect(names).toEqual(['Connect and manage your provider accounts', SETTINGS_LABEL]);
    expect(screen.queryByRole('group', { name: 'Connected integrations' })).toBeNull();
    expect(row?.children[1]?.contains(screen.getByTestId('update-indicator'))).toBe(true);
    expect(row?.children[1]?.contains(screen.getByTestId('beta-badge-trigger'))).toBe(true);
  });

  it('parks the update call to action next to the beta pill', () => {
    storeState.updaterStatus = 'available';
    render(<AppFooter {...footerProps()} />);

    const center = footerRow()?.children[1];

    expect(center?.contains(screen.getByTestId('beta-badge-trigger'))).toBe(true);
    expect(center?.contains(screen.getByTestId('update-indicator'))).toBe(true);
  });

  it('pulses the providers launcher icon until a provider connects, and never while its studio is open', () => {
    const { rerender } = render(<AppFooter {...footerProps()} />);
    const providers = () =>
      screen.getByRole('button', { name: 'Connect and manage your provider accounts' });
    const pulsing = () => providers().querySelector('.motion-safe\\:animate-soft-pulse');

    expect(pulsing()).not.toBeNull();
    expect(providers().className).not.toContain('animate-soft-pulse');

    rerender(
      <AppFooter
        {...footerProps({
          overrides: {
            target: targetFor({ overlay: { kind: 'settings', focus: { scope: 'providers' } } }),
          },
        })}
      />,
    );
    expect(pulsing()).toBeNull();

    storeState.providers = [{ connection: 'connected' }];
    rerender(<AppFooter {...footerProps()} />);
    expect(pulsing()).toBeNull();
  });

  it('lays the row out as three grid regions so the beta badge cannot overlap a cluster', () => {
    render(<AppFooter {...footerProps()} />);

    const beta = screen.getByTestId('beta-badge-trigger');
    const row = footerRow();

    expect(row?.className).toContain('grid');
    expect(row?.className).toContain('grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]');
    expect(beta.className).not.toContain('absolute');
    expect(row?.children.length).toBe(3);
  });

  it('keeps studio buttons muted at rest and gives the active one a subtle surface', () => {
    render(
      <AppFooter
        {...footerProps({ overrides: { target: targetFor({ overlay: { kind: 'workflow' } }) } })}
      />,
    );

    const settings = screen.getByRole('button', { name: SETTINGS_LABEL });
    const workflows = screen.getByRole('button', {
      name: 'Open the workflow library for this workspace',
    });

    expect(settings.className).toContain('text-muted-foreground');
    expect(workflows.className).toContain('bg-muted text-foreground');
  });

  it('gives settings the muted active fill instead of the inversion it had in the top bar', () => {
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

    expect(settings.className).toContain('bg-muted text-foreground');
    expect(settings.className).not.toContain('bg-foreground text-background');
  });

  it('invites the first connection when the workspace has none', () => {
    render(<AppFooter {...footerProps()} />);

    expect(screen.getByRole('group', { name: 'Connected integrations' }).children.length).toBe(0);
    expect(screen.getByRole('button', { name: 'Link your first integration' })).toBeDefined();
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

    fireEvent.click(screen.getByRole('button', { name: 'Link integration' }));

    const panel = screen.getByRole('dialog', { name: 'Integrations' });
    expect(within(panel).getByRole('button', { name: 'Open GitHub' })).toBeDefined();
    expect(within(panel).getByRole('button', { name: 'Connect Bitbucket' })).toBeDefined();

    fireEvent.click(within(panel).getByRole('button', { name: 'Connect GitLab' }));

    expect(onOpenIntegration).toHaveBeenCalledExactlyOnceWith({ provider: 'gitlab' });
    expect(screen.queryByRole('dialog', { name: 'Integrations' })).toBeNull();
  });

  it('names the connection state of every member in the popover', () => {
    render(<AppFooter {...footerProps({ overrides: { connected: connectedWith(['linear']) } })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Link integration' }));

    const panel = screen.getByRole('dialog', { name: 'Integrations' });
    expect(within(panel).getAllByRole('listitem').length).toBe(7);
    expect(within(panel).getAllByText('Not connected').length).toBe(6);
    expect(within(panel).getByText('Connected')).toBeDefined();
  });

  it('closes the popover on escape', () => {
    render(<AppFooter {...footerProps()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Link your first integration' }));
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
      fireEvent.click(screen.getByRole('button', { name: 'Link your first integration' }));
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
    const overlay: Overlay = { kind: 'settings', focus: { scope: 'tools', tool: 'sentry' } };
    render(<AppFooter {...footerProps({ overrides: { target: targetFor({ overlay }) } })} />);

    expect(screen.getByRole('button', { name: 'Link your first integration' }).className).toContain(
      'bg-muted text-foreground',
    );
  });

  it('moves that active state onto the glyph once its inbox is open', () => {
    const connected = connectedWith(['sentry']);
    const overlay: Overlay = {
      kind: 'inbox',
      focus: { provider: 'sentry', kind: null, recordKey: null, sessionId: null },
    };
    render(
      <AppFooter
        {...footerProps({ overrides: { connected, target: targetFor({ overlay, connected }) } })}
      />,
    );

    expect(screen.getByRole('button', { name: 'Sentry' }).className).toContain(
      'bg-muted text-foreground',
    );
    expect(screen.getByRole('button', { name: 'Link integration' }).className).toContain(
      'text-muted-foreground',
    );
  });

  it('keeps the link action reachable with many connected integrations', () => {
    render(<AppFooter {...footerProps({ overrides: { connected: ALL_CONNECTED } })} />);

    expect(
      within(screen.getByRole('group', { name: 'Connected integrations' })).getAllByRole('button')
        .length,
    ).toBe(7);
    fireEvent.click(screen.getByRole('button', { name: 'Link integration' }));
    expect(screen.getByRole('dialog', { name: 'Integrations' })).toBeDefined();
  });
});
