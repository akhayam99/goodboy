// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import type { WorkspaceId } from '@goodboy/types';

const { state } = vi.hoisted(() => ({
  state: {
    providers: [] as ReadonlyArray<{ id: string; connection: string }>,
    refreshProviders: vi.fn(async () => undefined),
    providerConnect: {} as Record<string, { phase: string }>,
  },
}));

vi.mock('../../../../store', () => ({
  useAppStore: Object.assign(<T,>(selector: (store: typeof state) => T) => selector(state), {
    getState: () => state,
  }),
}));

vi.mock('./DefaultsPanel', () => ({
  DefaultsPanel: () => <h1>Defaults</h1>,
}));

vi.mock('./ProviderDetailPanel', () => ({
  ProviderDetailPanel: ({ info }: { info: { id: string } | null }) => (
    <h1>{`detail ${info?.id ?? 'none'}`}</h1>
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
  it('hands its provider list to the settings rail and lands on Defaults', () => {
    render(<ProviderSettingsScope workspaceId={'workspace-1' as WorkspaceId} frame={plainFrame} />);

    const rail = screen.getByRole('navigation', { name: 'Settings scopes' });
    const list = within(rail).getByRole('list', { name: 'Providers & models settings' });

    expect(within(list).getByRole('button', { name: 'Defaults' })).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Defaults' })).toBeDefined();
    expect(screen.queryByRole('complementary')).toBeNull();
  });

  it('hides Defaults without a workspace and opens the first provider instead', () => {
    state.providers = [{ id: 'anthropic', connection: 'connected' }];
    render(<ProviderSettingsScope workspaceId={null} frame={plainFrame} />);

    expect(screen.queryByRole('button', { name: 'Defaults' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Defaults' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'detail anthropic' })).toBeDefined();
  });
});
