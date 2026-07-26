import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../store', () => ({
  useAppStore: (
    selector: (state: { providers: ReadonlyArray<{ connection: string }> }) => unknown,
  ) => selector({ providers: [] }),
}));

vi.mock('../../../features/integrations/components/IntegrationGlyph', () => ({
  IntegrationGlyph: () => null,
}));

afterEach(cleanup);

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
});
