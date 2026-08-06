import type { ComponentProps } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../store', () => ({
  useAppStore: (
    selector: (state: { providers: ReadonlyArray<{ connection: string }> }) => unknown,
  ) => selector({ providers: [] }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

import { AppFooter } from './index';

type FooterProps = ComponentProps<typeof AppFooter>;

type Params = {
  readonly overrides?: Partial<FooterProps>;
};

const footerProps = ({ overrides = {} }: Params = {}): FooterProps => ({
  activeStudio: null,
  onOpenWorkflows: vi.fn(),
  onOpenProviders: vi.fn(),
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

describe('AppFooter', () => {
  it('opens each studio launcher on the right', () => {
    const onOpenWorkflows = vi.fn();
    const onOpenProviders = vi.fn();
    const onOpenBudget = vi.fn();
    const onOpenImpact = vi.fn();
    const onOpenChangelog = vi.fn();
    render(
      <AppFooter
        {...footerProps({
          overrides: {
            onOpenWorkflows,
            onOpenProviders,
            onOpenBudget,
            onOpenImpact,
            onOpenChangelog,
          },
        })}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Open the workflow library for this workspace' }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Connect and manage your provider accounts' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open budget studio' }));
    fireEvent.click(
      screen.getByRole('button', {
        name: 'See how orchestration changed the way this workspace works',
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'See what changed, release by release' }));

    expect(onOpenWorkflows).toHaveBeenCalledOnce();
    expect(onOpenProviders).toHaveBeenCalledOnce();
    expect(onOpenBudget).toHaveBeenCalledOnce();
    expect(onOpenImpact).toHaveBeenCalledOnce();
    expect(onOpenChangelog).toHaveBeenCalledOnce();
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
    render(<AppFooter {...footerProps({ overrides: { activeStudio: 'impact' } })} />);

    const budget = screen.getByRole('button', { name: 'Open budget studio' });
    const impact = screen.getByRole('button', {
      name: 'See how orchestration changed the way this workspace works',
    });

    expect(budget.className).toContain('text-muted-foreground');
    expect(impact.className).toContain('bg-muted text-foreground');
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

  it('disables the add control with a reason once every member of a category is connected', () => {
    render(<AppFooter {...footerProps({ overrides: { slackEnabled: true } })} />);

    const add = screen.getByRole('button', { name: 'Connect a conversation tool' });
    expect(add.getAttribute('aria-disabled')).toBe('true');

    fireEvent.click(add);

    expect(screen.queryByRole('dialog', { name: 'Conversation tools' })).toBeNull();
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
