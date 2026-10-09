// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import type { WorkspaceId } from '@goodboy/types';

const { state } = vi.hoisted(() => ({
  state: {
    providers: [] as ReadonlyArray<{ id: string; connection: string }>,
    workspaces: [{ id: 'workspace-1', name: 'Harborline' }] as ReadonlyArray<{
      id: string;
      name: string;
    }>,
    cliRequirements: [] as ReadonlyArray<never>,
    refreshProviders: vi.fn(async () => undefined),
    providerConnect: {} as Record<string, { phase: string }>,
    providerLimits: {},
  },
}));

vi.mock('../../../../store', () => ({
  useAppStore: Object.assign(<T,>(selector: (store: typeof state) => T) => selector(state), {
    getState: () => state,
  }),
}));

vi.mock('./DefaultsPanel', () => ({
  DefaultsPanel: ({ scopeLabel }: { scopeLabel?: string | null }) => (
    <>
      <h1>Models</h1>
      <span data-testid="scope">{scopeLabel ?? ''}</span>
    </>
  ),
}));

vi.mock('./ProviderPage', () => ({
  ProviderPage: ({
    info,
    scopeLabel,
  }: {
    info: { id: string } | null;
    scopeLabel?: string | null;
  }) => (
    <>
      <h1>{`detail ${info?.id ?? 'none'}`}</h1>
      <span data-testid="scope">{scopeLabel ?? ''}</span>
    </>
  ),
}));

import { ProviderSettingsScope } from './index';
import type { ScopeFrameParts } from '../../../settings/components/SettingsStudio/types';

const plainFrame = ({ nested, detail }: ScopeFrameParts) => (
  <>
    <nav aria-label="Settings scopes">{nested}</nav>
    {detail}
  </>
);

afterEach(cleanup);

describe('ProviderSettingsScope', () => {
  it('hands its provider list to the settings rail and lands on Models', () => {
    render(<ProviderSettingsScope workspaceId={'workspace-1' as WorkspaceId} frame={plainFrame} />);

    const rail = screen.getByRole('navigation', { name: 'Settings scopes' });
    const list = within(rail).getByRole('list', { name: 'Providers & models settings' });

    expect(within(list).getByRole('button', { name: 'Models' })).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Models' })).toBeDefined();
    expect(screen.queryByRole('complementary')).toBeNull();
  });

  it('hides Models without a workspace and opens the first provider instead', () => {
    state.providers = [{ id: 'anthropic', connection: 'connected' }];
    render(<ProviderSettingsScope workspaceId={null} frame={plainFrame} />);

    expect(screen.queryByRole('button', { name: 'Models' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Models' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'detail anthropic' })).toBeDefined();
  });

  it('names the workspace as the scope of the Models page', () => {
    render(<ProviderSettingsScope workspaceId={'workspace-1' as WorkspaceId} frame={plainFrame} />);

    expect(screen.getByTestId('scope').textContent).toBe('Harborline');
  });

  it('names the workspace on a provider page too', () => {
    state.providers = [{ id: 'anthropic', connection: 'connected' }];
    render(
      <ProviderSettingsScope
        workspaceId={'workspace-1' as WorkspaceId}
        initialFocus="anthropic"
        frame={plainFrame}
      />,
    );

    expect(screen.getByRole('heading', { name: 'detail anthropic' })).toBeDefined();
    expect(screen.getByTestId('scope').textContent).toBe('Harborline');
  });

  it('says All workspaces when there is no workspace scope', () => {
    state.providers = [{ id: 'anthropic', connection: 'connected' }];
    render(<ProviderSettingsScope workspaceId={null} frame={plainFrame} />);

    expect(screen.getByTestId('scope').textContent).toBe('All workspaces');
  });
});
