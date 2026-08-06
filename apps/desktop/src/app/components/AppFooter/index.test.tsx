import type { ComponentProps } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IntegrationGlyphProvider } from '../../../features/integrations/components/IntegrationGlyph';
import { FOOTER_CATEGORIES, FOOTER_INTEGRATION_PROVIDERS } from './categories';

const { flags, storeState } = vi.hoisted(() => ({
  flags: { unseenRelease: false },
  storeState: {
    providers: [] as ReadonlyArray<{ readonly connection: string }>,
    updaterStatus: 'idle' as 'idle' | 'available' | 'downloading',
    updateVersion: '0.2.0' as string | null,
    installUpdate: vi.fn(async () => undefined),
  },
}));

vi.mock('../../../store', () => ({
  useAppStore: <T,>(selector: (state: typeof storeState) => T) => selector(storeState),
}));

vi.mock('../../../features/changelog/hooks/useUnseenRelease', () => ({
  useUnseenRelease: () => flags.unseenRelease,
}));

beforeEach(() => {
  flags.unseenRelease = false;
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
const REST_MORE_LABEL = 'More studios: budget, impact and changelog';
const UNSEEN_MORE_LABEL = 'More studios: budget, impact and changelog, new release notes to read';

const openMore = () => {
  fireEvent.click(screen.getByRole('button', { name: /^More studios/ }));
  return screen.getByRole('dialog', { name: 'More studios' });
};

type FooterProps = ComponentProps<typeof AppFooter>;

type Params = {
  readonly overrides?: Partial<FooterProps>;
};

const footerProps = ({ overrides = {} }: Params = {}): FooterProps => ({
  activeStudio: null,
  onOpenWorkflows: vi.fn(),
  onOpenProviders: vi.fn(),
  onOpenSettings: vi.fn(),
  onOpenBudget: vi.fn(),
  onOpenImpact: vi.fn(),
  onOpenChangelog: vi.fn(),
  onOpenGithub: vi.fn(),
  onOpenLinear: vi.fn(),
  onOpenJira: vi.fn(),
  onOpenSentry: vi.fn(),
  onOpenGitlab: vi.fn(),
  onOpenBitbucket: vi.fn(),
  onOpenSlack: vi.fn(),
  onConvertToDevProject: vi.fn(),
  githubEnabled: false,
  linearEnabled: false,
  jiraEnabled: false,
  sentryEnabled: false,
  gitlabEnabled: false,
  bitbucketEnabled: false,
  slackEnabled: false,
  isSimpleWorkspace: false,
  ...overrides,
});

const openerSpies = () => ({
  github: vi.fn(),
  gitlab: vi.fn(),
  bitbucket: vi.fn(),
  linear: vi.fn(),
  jira: vi.fn(),
  sentry: vi.fn(),
  slack: vi.fn(),
});

type RoutingParams = {
  readonly spies: ReturnType<typeof openerSpies>;
  readonly connected: boolean;
};

const routingProps = ({ spies, connected }: RoutingParams): FooterProps =>
  footerProps({
    overrides: {
      onOpenGithub: spies.github,
      onOpenGitlab: spies.gitlab,
      onOpenBitbucket: spies.bitbucket,
      onOpenLinear: spies.linear,
      onOpenJira: spies.jira,
      onOpenSentry: spies.sentry,
      onOpenSlack: spies.slack,
      githubEnabled: connected,
      gitlabEnabled: connected,
      bitbucketEnabled: connected,
      linearEnabled: connected,
      jiraEnabled: connected,
      sentryEnabled: connected,
      slackEnabled: connected,
    },
  });

type ExpectRoutedParams = {
  readonly spies: ReturnType<typeof openerSpies>;
  readonly provider: IntegrationGlyphProvider;
};

const expectRoutedOnlyTo = ({ spies, provider }: ExpectRoutedParams) => {
  FOOTER_INTEGRATION_PROVIDERS.forEach((candidate) => {
    expect(
      spies[candidate].mock.calls.length,
      `${candidate} opener while ${provider} was picked`,
    ).toBe(candidate === provider ? 1 : 0);
  });
};

describe('AppFooter', () => {
  it('keeps workflows, providers and settings one click away on the right', () => {
    const onOpenWorkflows = vi.fn();
    const onOpenProviders = vi.fn();
    const onOpenSettings = vi.fn();
    render(
      <AppFooter
        {...footerProps({ overrides: { onOpenWorkflows, onOpenProviders, onOpenSettings } })}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Open the workflow library for this workspace' }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Connect and manage your provider accounts' }),
    );
    fireEvent.click(screen.getByRole('button', { name: SETTINGS_LABEL }));

    expect(onOpenWorkflows).toHaveBeenCalledOnce();
    expect(onOpenProviders).toHaveBeenCalledOnce();
    expect(onOpenSettings).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: 'Open budget studio' })).toBeNull();
    expect(
      screen.queryByRole('button', {
        name: 'See how orchestration changed the way this workspace works',
      }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'See what changed, release by release' }),
    ).toBeNull();
  });

  it('routes budget, impact and changelog through the more menu', () => {
    const onOpenBudget = vi.fn();
    const onOpenImpact = vi.fn();
    const onOpenChangelog = vi.fn();
    const { rerender } = render(
      <AppFooter
        {...footerProps({ overrides: { onOpenBudget, onOpenImpact, onOpenChangelog } })}
      />,
    );

    fireEvent.click(within(openMore()).getByRole('button', { name: 'Open budget studio' }));
    expect(onOpenBudget).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog', { name: 'More studios' })).toBeNull();

    fireEvent.click(
      within(openMore()).getByRole('button', {
        name: 'See how orchestration changed the way this workspace works',
      }),
    );
    expect(onOpenImpact).toHaveBeenCalledOnce();

    fireEvent.click(
      within(openMore()).getByRole('button', { name: 'See what changed, release by release' }),
    );
    expect(onOpenChangelog).toHaveBeenCalledOnce();

    rerender(<AppFooter {...footerProps({ overrides: { activeStudio: 'impact' } })} />);
    expect(screen.getByRole('button', { name: /^More studios/ }).className).toContain(
      'bg-muted text-foreground',
    );
  });

  it('closes the more menu on escape', () => {
    render(<AppFooter {...footerProps()} />);

    openMore();
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByRole('dialog', { name: 'More studios' })).toBeNull();
  });

  it('dots the more control for release notes the running version has not shown', () => {
    const { rerender } = render(<AppFooter {...footerProps()} />);

    expect(screen.queryByTestId('more-studios-dot')).toBeNull();
    expect(screen.getByRole('button', { name: REST_MORE_LABEL })).toBeDefined();

    flags.unseenRelease = true;
    rerender(<AppFooter {...footerProps()} />);

    expect(screen.getByTestId('more-studios-dot')).toBeDefined();
    expect(screen.getByRole('button', { name: UNSEEN_MORE_LABEL })).toBeDefined();
  });

  it('shows the update control only while an update is pending', () => {
    const { rerender } = render(<AppFooter {...footerProps()} />);

    expect(screen.queryByTestId('update-indicator')).toBeNull();

    storeState.updaterStatus = 'available';
    rerender(<AppFooter {...footerProps()} />);

    expect(screen.getByTestId('update-indicator').textContent).toContain('Update to 0.2.0');
  });

  it('orders the right cluster as workflows, providers, settings, update, more', () => {
    storeState.updaterStatus = 'available';
    render(<AppFooter {...footerProps()} />);

    const beta = screen.getByText('Beta');
    const row = beta.parentElement;
    const cluster = row?.children[2];
    const buttons = Array.from(cluster?.querySelectorAll('button') ?? []).filter(
      (button) => button.closest('dialog') == null,
    );
    const names = buttons.map((button) => button.getAttribute('aria-label') ?? button.textContent);

    expect(names).toEqual([
      'Open the workflow library for this workspace',
      'Connect and manage your provider accounts',
      SETTINGS_LABEL,
      'Update to 0.2.0',
      REST_MORE_LABEL,
    ]);
  });

  it('pulses the providers launcher until a provider connects, and never while its studio is open', () => {
    const { rerender } = render(<AppFooter {...footerProps()} />);
    const providers = () =>
      screen.getByRole('button', { name: 'Connect and manage your provider accounts' });

    expect(providers().className).toContain('motion-safe:animate-soft-pulse');

    rerender(<AppFooter {...footerProps({ overrides: { activeStudio: 'provider' } })} />);
    expect(providers().className).not.toContain('animate-soft-pulse');

    storeState.providers = [{ connection: 'connected' }];
    rerender(<AppFooter {...footerProps()} />);
    expect(providers().className).not.toContain('animate-soft-pulse');
  });

  it('lays the row out as three grid regions so the beta chip cannot overlap a cluster', () => {
    render(<AppFooter {...footerProps()} />);

    const beta = screen.getByText('Beta');
    const row = beta.parentElement;

    expect(row?.className).toContain('grid');
    expect(row?.className).toContain('grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]');
    expect(beta.className).not.toContain('absolute');
    expect(row?.children.length).toBe(3);
  });

  it('keeps studio buttons muted at rest and gives the active one a subtle surface', () => {
    render(<AppFooter {...footerProps({ overrides: { activeStudio: 'workflow' } })} />);

    const settings = screen.getByRole('button', { name: SETTINGS_LABEL });
    const workflows = screen.getByRole('button', {
      name: 'Open the workflow library for this workspace',
    });

    expect(settings.className).toContain('text-muted-foreground');
    expect(workflows.className).toContain('bg-muted text-foreground');
  });

  it('gives settings the muted active fill instead of the inversion it had in the top bar', () => {
    render(<AppFooter {...footerProps({ overrides: { activeStudio: 'settings' } })} />);

    const settings = screen.getByRole('button', { name: SETTINGS_LABEL });

    expect(settings.className).toContain('bg-muted text-foreground');
    expect(settings.className).not.toContain('bg-foreground text-background');
  });

  it('splits the integrations into code hosts, trackers and conversation tools', () => {
    render(<AppFooter {...footerProps()} />);

    expect(screen.getByRole('group', { name: 'Code hosts' })).toBeDefined();
    expect(screen.getByRole('group', { name: 'Trackers' })).toBeDefined();
    expect(screen.getByRole('group', { name: 'Conversation tools' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Connect a code host' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Connect a tracker' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Connect a conversation tool' })).toBeDefined();
  });

  it('renders only connected integrations in the row, as glyphs with no text label', () => {
    const onOpenGithub = vi.fn();
    render(
      <AppFooter
        {...footerProps({ overrides: { githubEnabled: true, linearEnabled: true, onOpenGithub } })}
      />,
    );

    const codeHosts = screen.getByRole('group', { name: 'Code hosts' });
    const github = within(codeHosts).getByRole('button', {
      name: 'Review and act on pull requests across this workspace',
    });

    expect(github.textContent).toBe('');
    expect(within(codeHosts).getAllByRole('button').length).toBe(2);
    expect(
      within(screen.getByRole('group', { name: 'Trackers' })).getAllByRole('button').length,
    ).toBe(2);

    fireEvent.click(github);
    expect(onOpenGithub).toHaveBeenCalledOnce();
  });

  it('reaches a disconnected integration through the add popover of its category', () => {
    const onOpenGitlab = vi.fn();
    render(<AppFooter {...footerProps({ overrides: { githubEnabled: true, onOpenGitlab } })} />);

    expect(screen.queryByRole('button', { name: 'Connect GitLab' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Connect a code host' }));

    const panel = screen.getByRole('dialog', { name: 'Code hosts' });
    expect(within(panel).getByRole('button', { name: 'Open GitHub' })).toBeDefined();
    expect(within(panel).getByRole('button', { name: 'Connect Bitbucket' })).toBeDefined();

    fireEvent.click(within(panel).getByRole('button', { name: 'Connect GitLab' }));

    expect(onOpenGitlab).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog', { name: 'Code hosts' })).toBeNull();
  });

  it('names the connection state of every member in the popover', () => {
    render(<AppFooter {...footerProps({ overrides: { linearEnabled: true } })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Connect a tracker' }));

    const panel = screen.getByRole('dialog', { name: 'Trackers' });
    expect(within(panel).getAllByRole('listitem').length).toBe(3);
    expect(within(panel).getAllByText('Not connected').length).toBe(2);
    expect(within(panel).getByText('Connected')).toBeDefined();
  });

  it('closes the popover on escape', () => {
    render(<AppFooter {...footerProps()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Connect a tracker' }));
    expect(screen.getByRole('dialog', { name: 'Trackers' })).toBeDefined();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByRole('dialog', { name: 'Trackers' })).toBeNull();
  });

  it('disables the add control once every member of a category is connected and names the reason', () => {
    render(<AppFooter {...footerProps({ overrides: { slackEnabled: true } })} />);

    const add = screen.getByRole('button', { name: 'Every conversation tool is connected' });
    expect(add.getAttribute('aria-disabled')).toBe('true');
    expect(screen.queryByRole('button', { name: 'Connect a conversation tool' })).toBeNull();

    fireEvent.click(add);

    expect(screen.queryByRole('dialog', { name: 'Conversation tools' })).toBeNull();
  });

  it('sends every connected glyph to its own studio and to no other', () => {
    FOOTER_CATEGORIES.forEach((category) => {
      category.members.forEach((member) => {
        const spies = openerSpies();
        render(<AppFooter {...routingProps({ spies, connected: true })} />);

        fireEvent.click(screen.getByRole('button', { name: member.connectedLabel }));

        expectRoutedOnlyTo({ spies, provider: member.provider });
        cleanup();
      });
    });
  });

  it('sends every popover row to its own studio and to no other', () => {
    FOOTER_CATEGORIES.forEach((category) => {
      category.members.forEach((member) => {
        const spies = openerSpies();
        render(<AppFooter {...routingProps({ spies, connected: false })} />);

        fireEvent.click(screen.getByRole('button', { name: category.addLabel }));
        fireEvent.click(
          within(screen.getByRole('dialog', { name: category.groupLabel })).getByRole('button', {
            name: member.connectLabel,
          }),
        );

        expectRoutedOnlyTo({ spies, provider: member.provider });
        cleanup();
      });
    });
  });

  it('places every integration in exactly one category', () => {
    const placed = FOOTER_CATEGORIES.flatMap((category) =>
      category.members.map((member) => member.provider),
    );

    expect([...placed].sort()).toEqual([...FOOTER_INTEGRATION_PROVIDERS].sort());
  });

  it('keeps the three groups in order with a divider between each pair', () => {
    render(<AppFooter {...footerProps()} />);

    const groups = screen.getAllByRole('group');
    expect(groups.map((group) => group.getAttribute('aria-label'))).toEqual([
      'Code hosts',
      'Trackers',
      'Conversation tools',
    ]);

    const cluster = groups[0]?.parentElement;
    expect(Array.from(cluster?.children ?? []).map((child) => child.getAttribute('role'))).toEqual([
      'group',
      'separator',
      'group',
      'separator',
      'group',
    ]);
  });

  it('holds the active state on the group whose disconnected member owns the open studio', () => {
    render(<AppFooter {...footerProps({ overrides: { activeStudio: 'sentry' } })} />);

    expect(screen.getByRole('button', { name: 'Connect a tracker' }).className).toContain(
      'bg-muted text-foreground',
    );
    expect(screen.getByRole('button', { name: 'Connect a code host' }).className).toContain(
      'text-muted-foreground',
    );
  });

  it('moves that active state onto the glyph once the integration is connected', () => {
    render(
      <AppFooter
        {...footerProps({ overrides: { activeStudio: 'sentry', sentryEnabled: true } })}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Launch a session from a Sentry issue' }).className,
    ).toContain('bg-muted text-foreground');
    expect(screen.getByRole('button', { name: 'Connect a tracker' }).className).toContain(
      'text-muted-foreground',
    );
  });

  it('names a category with nothing connected and drops to a glyph once a member connects', () => {
    const { rerender } = render(<AppFooter {...footerProps()} />);

    expect(screen.getByRole('button', { name: 'Connect a code host' }).textContent).toBe(
      'Code host',
    );
    expect(screen.getByRole('button', { name: 'Connect a tracker' }).textContent).toBe('Tracker');
    expect(screen.getByRole('button', { name: 'Connect a conversation tool' }).textContent).toBe(
      'Conversation tool',
    );

    rerender(<AppFooter {...footerProps({ overrides: { linearEnabled: true } })} />);

    expect(screen.getByRole('button', { name: 'Connect a tracker' }).textContent).toBe('');
    expect(screen.getByRole('button', { name: 'Connect a code host' }).textContent).toBe(
      'Code host',
    );
  });

  it('swaps the code hosts for the conversion CTA and drops Sentry in a simple workspace', () => {
    const onConvertToDevProject = vi.fn();
    render(
      <AppFooter
        {...footerProps({ overrides: { isSimpleWorkspace: true, onConvertToDevProject } })}
      />,
    );

    expect(screen.queryByRole('group', { name: 'Code hosts' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Connect a code host' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Connect a tracker' }));
    const panel = screen.getByRole('dialog', { name: 'Trackers' });
    expect(within(panel).getByRole('button', { name: 'Connect Linear' })).toBeDefined();
    expect(within(panel).getByRole('button', { name: 'Connect Jira' })).toBeDefined();
    expect(within(panel).queryByRole('button', { name: 'Connect Sentry' })).toBeNull();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Turn this workspace into a dev project backed by a git repository',
      }),
    );

    expect(onConvertToDevProject).toHaveBeenCalledOnce();
  });

  it('keeps Slack reachable from the conversation group whether or not it is connected', () => {
    const onOpenSlack = vi.fn();
    const { rerender } = render(<AppFooter {...footerProps({ overrides: { onOpenSlack } })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Connect a conversation tool' }));
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Conversation tools' })).getByRole('button', {
        name: 'Connect Slack',
      }),
    );
    expect(onOpenSlack).toHaveBeenCalledOnce();

    rerender(<AppFooter {...footerProps({ overrides: { slackEnabled: true, onOpenSlack } })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Launch a session from a Slack thread' }));

    expect(onOpenSlack).toHaveBeenCalledTimes(2);
  });
});
