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

describe('AppFooter', () => {
  it('centers beta and opens each section', () => {
    const onOpenWorkflows = vi.fn();
    const onOpenProviders = vi.fn();
    const onOpenBudget = vi.fn();
    const onOpenImpact = vi.fn();
    const onOpenChangelog = vi.fn();
    render(
      <AppFooter
        activeStudio={null}
        onOpenWorkflows={onOpenWorkflows}
        onOpenProviders={onOpenProviders}
        onOpenBudget={onOpenBudget}
        onOpenImpact={onOpenImpact}
        onOpenChangelog={onOpenChangelog}
        onOpenGithub={vi.fn()}
        onOpenLinear={vi.fn()}
        onOpenSentry={vi.fn()}
        onOpenGitlab={vi.fn()}
        githubEnabled={false}
        linearEnabled={false}
        sentryEnabled={false}
        gitlabEnabled={false}
        isSimpleWorkspace={false}
        onConvertToDevProject={vi.fn()}
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

  it('keeps notifications out of the footer, the bell owns that studio', () => {
    render(
      <AppFooter
        activeStudio="notifications"
        onOpenWorkflows={vi.fn()}
        onOpenProviders={vi.fn()}
        onOpenBudget={vi.fn()}
        onOpenImpact={vi.fn()}
        onOpenChangelog={vi.fn()}
        onOpenGithub={vi.fn()}
        onOpenLinear={vi.fn()}
        onOpenSentry={vi.fn()}
        onOpenGitlab={vi.fn()}
        githubEnabled={false}
        linearEnabled={false}
        sentryEnabled={false}
        gitlabEnabled={false}
        isSimpleWorkspace={false}
        onConvertToDevProject={vi.fn()}
      />,
    );

    expect(screen.queryByText(/notification/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /notification/i })).toBeNull();
    for (const button of screen.getAllByRole('button')) {
      expect(button.className).not.toContain('bg-muted text-foreground');
    }
  });

  it('keeps studio buttons muted at rest and gives the active one a subtle surface', () => {
    render(
      <AppFooter
        activeStudio="impact"
        onOpenWorkflows={vi.fn()}
        onOpenProviders={vi.fn()}
        onOpenBudget={vi.fn()}
        onOpenImpact={vi.fn()}
        onOpenChangelog={vi.fn()}
        onOpenGithub={vi.fn()}
        onOpenLinear={vi.fn()}
        onOpenSentry={vi.fn()}
        onOpenGitlab={vi.fn()}
        githubEnabled={false}
        linearEnabled={false}
        sentryEnabled={false}
        gitlabEnabled={false}
        isSimpleWorkspace={false}
        onConvertToDevProject={vi.fn()}
      />,
    );

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

    render(
      <AppFooter
        activeStudio={null}
        onOpenWorkflows={vi.fn()}
        onOpenProviders={vi.fn()}
        onOpenBudget={vi.fn()}
        onOpenImpact={vi.fn()}
        onOpenChangelog={vi.fn()}
        onOpenGithub={vi.fn()}
        onOpenLinear={vi.fn()}
        onOpenSentry={vi.fn()}
        onOpenGitlab={onOpenGitlab}
        githubEnabled={false}
        linearEnabled={false}
        sentryEnabled={false}
        gitlabEnabled={false}
        isSimpleWorkspace={false}
        onConvertToDevProject={vi.fn()}
      />,
    );

    expect(integrationGlyph.mock.calls.map(([provider]) => provider)).toEqual([
      'github',
      'gitlab',
      'linear',
      'sentry',
    ]);
    expect(screen.getByRole('button', { name: 'Connect GitHub' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Connect GitLab' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Connect Linear' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Connect Sentry' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Connect GitLab' }));

    expect(onOpenGitlab).toHaveBeenCalledOnce();
  });

  it('keeps Linear and swaps the git integrations for the conversion CTA in a simple workspace', () => {
    const onConvertToDevProject = vi.fn();

    render(
      <AppFooter
        activeStudio={null}
        onOpenWorkflows={vi.fn()}
        onOpenProviders={vi.fn()}
        onOpenBudget={vi.fn()}
        onOpenImpact={vi.fn()}
        onOpenChangelog={vi.fn()}
        onOpenGithub={vi.fn()}
        onOpenLinear={vi.fn()}
        onOpenSentry={vi.fn()}
        onOpenGitlab={vi.fn()}
        githubEnabled={false}
        linearEnabled={false}
        sentryEnabled={false}
        gitlabEnabled={false}
        isSimpleWorkspace
        onConvertToDevProject={onConvertToDevProject}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Connect GitHub' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Connect GitLab' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Connect Sentry' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Connect Linear' })).toBeDefined();
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
    render(
      <AppFooter
        activeStudio={null}
        onOpenWorkflows={vi.fn()}
        onOpenProviders={vi.fn()}
        onOpenBudget={vi.fn()}
        onOpenImpact={vi.fn()}
        onOpenChangelog={vi.fn()}
        onOpenGithub={vi.fn()}
        onOpenLinear={vi.fn()}
        onOpenSentry={vi.fn()}
        onOpenGitlab={onOpenGitlab}
        githubEnabled={false}
        linearEnabled={false}
        sentryEnabled={false}
        gitlabEnabled
        isSimpleWorkspace={false}
        onConvertToDevProject={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Review merge requests and launch a session from a GitLab issue',
      }),
    );

    expect(onOpenGitlab).toHaveBeenCalledOnce();
  });
});
