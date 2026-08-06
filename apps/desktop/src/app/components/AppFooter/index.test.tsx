import type { ComponentProps } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { integrationGlyph } = vi.hoisted(() => ({
  integrationGlyph: vi.fn(),
}));

type MockGlyphProps = {
  provider: string;
};

vi.mock('../../../store', () => ({
  useAppStore: (
    selector: (state: { providers: ReadonlyArray<{ connection: string }> }) => unknown,
  ) => selector({ providers: [] }),
}));

vi.mock('../../../features/integrations/components/IntegrationGlyph', () => ({
  IntegrationGlyph: ({ provider }: MockGlyphProps) => {
    integrationGlyph(provider);
    return null;
  },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

import { AppFooter } from './index';
import { BetaPill } from '../../../shared/components/BetaPill';

const BETA_CENTERING = 'pointer-events-none absolute inset-x-0 mx-auto w-fit';

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
  it('centers beta and opens each section', () => {
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

    const beta = screen.getByText('Beta');
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Open the workflow library for this workspace',
      }),
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Connect and manage your provider accounts',
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open budget studio' }));
    fireEvent.click(
      screen.getByRole('button', {
        name: 'See how orchestration changed the way this workspace works',
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'See what changed, release by release' }));

    const { container } = render(<BetaPill className={BETA_CENTERING} />);
    expect(beta.className).toBe(container.firstElementChild?.className);
    expect(onOpenWorkflows).toHaveBeenCalledOnce();
    expect(onOpenProviders).toHaveBeenCalledOnce();
    expect(onOpenBudget).toHaveBeenCalledOnce();
    expect(onOpenImpact).toHaveBeenCalledOnce();
    expect(onOpenChangelog).toHaveBeenCalledOnce();
  });

  it('keeps studio buttons muted at rest and gives the active one a subtle surface', () => {
    render(<AppFooter {...footerProps({ overrides: { activeStudio: 'impact' } })} />);

    const budget = screen.getByRole('button', { name: 'Open budget studio' });
    const impact = screen.getByRole('button', {
      name: 'See how orchestration changed the way this workspace works',
    });

    expect(budget.className).toContain('text-muted-foreground');
    expect(budget.className).not.toContain('text-warning');
    expect(impact.className).toContain('bg-muted text-foreground');
    expect(impact.className).not.toContain('text-success');
  });

  it('renders every disconnected integration and opens its studio', () => {
    const onOpenGitlab = vi.fn();

    render(<AppFooter {...footerProps({ overrides: { onOpenGitlab } })} />);

    expect(integrationGlyph.mock.calls.map(([provider]) => provider)).toEqual([
      'github',
      'gitlab',
      'bitbucket',
      'linear',
      'jira',
      'slack',
      'sentry',
    ]);
    expect(screen.getByRole('button', { name: 'Connect GitHub' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Connect GitLab' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Connect Bitbucket' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Connect Linear' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Connect Jira' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Connect Sentry' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Connect Slack' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Connect GitLab' }));

    expect(onOpenGitlab).toHaveBeenCalledOnce();
  });

  it('keeps Linear and swaps the git integrations for the conversion CTA in a simple workspace', () => {
    const onConvertToDevProject = vi.fn();

    render(
      <AppFooter
        {...footerProps({ overrides: { isSimpleWorkspace: true, onConvertToDevProject } })}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Connect GitHub' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Connect GitLab' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Connect Bitbucket' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Connect Sentry' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Connect Linear' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Connect Jira' })).toBeDefined();
    expect(
      screen.getByRole('button', { name: 'Open the workflow library for this workspace' }),
    ).toBeDefined();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Turn this workspace into a dev project backed by a git repository',
      }),
    );

    expect(onConvertToDevProject).toHaveBeenCalledOnce();
  });

  it('opens the GitLab studio when GitLab is connected', () => {
    const onOpenGitlab = vi.fn();
    render(<AppFooter {...footerProps({ overrides: { gitlabEnabled: true, onOpenGitlab } })} />);

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Review merge requests and launch a session from a GitLab issue',
      }),
    );

    expect(onOpenGitlab).toHaveBeenCalledOnce();
  });

  it('offers the Bitbucket studio and says so when Bitbucket is not connected yet', () => {
    const onOpenBitbucket = vi.fn();
    const { rerender } = render(<AppFooter {...footerProps({ overrides: { onOpenBitbucket } })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Connect Bitbucket' }));
    expect(onOpenBitbucket).toHaveBeenCalledOnce();

    rerender(
      <AppFooter {...footerProps({ overrides: { bitbucketEnabled: true, onOpenBitbucket } })} />,
    );

    expect(
      screen.getByRole('button', { name: 'Review pull requests across this workspace' }),
    ).toBeDefined();
  });

  it('offers the Slack studio and says so when Slack is not connected yet', () => {
    const onOpenSlack = vi.fn();
    const { rerender } = render(<AppFooter {...footerProps({ overrides: { onOpenSlack } })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Connect Slack' }));
    expect(onOpenSlack).toHaveBeenCalledOnce();

    rerender(<AppFooter {...footerProps({ overrides: { slackEnabled: true, onOpenSlack } })} />);

    expect(
      screen.getByRole('button', { name: 'Launch a session from a Slack thread' }),
    ).toBeDefined();
  });
});
