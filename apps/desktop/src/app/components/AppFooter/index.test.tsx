import type { ComponentProps } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

vi.mock('./GoodboyChip', () => ({
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

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

import { AppFooter } from './index';
import { shortcutGlyphs } from '../../../shared/keyboard/registry';

const SETTINGS_LABEL = `Open settings (${shortcutGlyphs('settings.open')})`;

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
  it('keeps inbox, workflows and settings one click away on the right, in that order', () => {
    const onOpenInbox = vi.fn();
    const onOpenWorkflows = vi.fn();
    const onOpenSettings = vi.fn();
    render(
      <AppFooter
        {...footerProps({ overrides: { onOpenInbox, onOpenWorkflows, onOpenSettings } })}
      />,
    );

    expect(rightNames()).toEqual([
      'Open the inbox for this workspace',
      'Open the workflow library for this workspace',
      SETTINGS_LABEL,
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Open the inbox for this workspace' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Open the workflow library for this workspace' }),
    );
    fireEvent.click(screen.getByRole('button', { name: SETTINGS_LABEL }));

    expect(onOpenInbox).toHaveBeenCalledOnce();
    expect(onOpenWorkflows).toHaveBeenCalledOnce();
    expect(onOpenSettings).toHaveBeenCalledOnce();
  });

  it('carries no providers launcher and no more menu', () => {
    render(<AppFooter {...footerProps()} />);

    expect(
      screen.queryByRole('button', { name: 'Connect and manage your provider accounts' }),
    ).toBeNull();
    expect(screen.queryByRole('button', { name: /^More pages/ })).toBeNull();
    expect(screen.queryByText('Providers')).toBeNull();
    expect(screen.queryByText('More')).toBeNull();
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

    expect(screen.getByRole('button', { name: SETTINGS_LABEL }).className).toContain(
      'bg-muted text-foreground',
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

  it('drops words before glyphs at narrow widths and keeps the first link label', () => {
    const { container, unmount } = render(
      <AppFooter {...footerProps({ overrides: { connected: ALL_CONNECTED } })} />,
    );

    expect(container.querySelector('.\\@container\\/footer')).not.toBeNull();
    ['Inbox', 'Workflows', 'Settings', 'Link integration'].forEach((word) => {
      expect(screen.getByText(word).className).toContain('@min-chrome-labels/footer:inline');
    });
    unmount();

    render(<AppFooter {...footerProps()} />);
    expect(screen.getByText('Link integration').className).not.toContain('hidden');
  });
});
