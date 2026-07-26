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

describe('AppFooter', () => {
  it('centers beta and opens each section', () => {
    const onOpenWorkflows = vi.fn();
    const onOpenProviders = vi.fn();
    const onOpenBudget = vi.fn();
    render(
      <AppFooter
        activeStudio={null}
        onOpenWorkflows={onOpenWorkflows}
        onOpenProviders={onOpenProviders}
        onOpenBudget={onOpenBudget}
        onOpenGithub={vi.fn()}
        onOpenLinear={vi.fn()}
        onOpenSentry={vi.fn()}
        onOpenGitlab={vi.fn()}
        githubEnabled={false}
        linearEnabled={false}
        sentryEnabled={false}
        gitlabEnabled={false}
      />,
    );

    const beta = screen.getByText('Beta');
    fireEvent.click(
      screen.getByRole('button', {
        name: 'open the workflow library for this workspace',
      }),
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: 'connect and manage your provider accounts',
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'open budget studio' }));

    expect(beta.className).toContain('absolute inset-x-0 mx-auto w-fit');
    expect(onOpenWorkflows).toHaveBeenCalledOnce();
    expect(onOpenProviders).toHaveBeenCalledOnce();
    expect(onOpenBudget).toHaveBeenCalledOnce();
  });

  it('renders every disconnected integration and opens its studio', () => {
    const onOpenGitlab = vi.fn();

    render(
      <AppFooter
        activeStudio={null}
        onOpenWorkflows={vi.fn()}
        onOpenProviders={vi.fn()}
        onOpenBudget={vi.fn()}
        onOpenGithub={vi.fn()}
        onOpenLinear={vi.fn()}
        onOpenSentry={vi.fn()}
        onOpenGitlab={onOpenGitlab}
        githubEnabled={false}
        linearEnabled={false}
        sentryEnabled={false}
        gitlabEnabled={false}
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

  it('opens the GitLab studio when GitLab is connected', () => {
    const onOpenGitlab = vi.fn();
    render(
      <AppFooter
        activeStudio={null}
        onOpenWorkflows={vi.fn()}
        onOpenProviders={vi.fn()}
        onOpenBudget={vi.fn()}
        onOpenGithub={vi.fn()}
        onOpenLinear={vi.fn()}
        onOpenSentry={vi.fn()}
        onOpenGitlab={onOpenGitlab}
        githubEnabled={false}
        linearEnabled={false}
        sentryEnabled={false}
        gitlabEnabled
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'launch a session from a GitLab issue' }));

    expect(onOpenGitlab).toHaveBeenCalledOnce();
  });
});
