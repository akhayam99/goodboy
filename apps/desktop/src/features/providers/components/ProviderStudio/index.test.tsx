// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
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

import { ProviderSettingsScope } from './index';

afterEach(cleanup);

describe('ProviderSettingsScope', () => {
  it('keeps the providers rail and the Defaults panel side by side in a flex row', () => {
    render(<ProviderSettingsScope workspaceId={'workspace-1' as WorkspaceId} />);

    const aside = screen.getByRole('complementary', { name: 'Providers' });
    const heading = screen.getByRole('heading', { name: 'Defaults' });
    const wrapper = aside.parentElement;

    expect(wrapper).not.toBeNull();
    expect(wrapper?.classList.contains('flex')).toBe(true);
    expect(Array.from(wrapper?.children ?? []).some((child) => child.contains(heading))).toBe(true);
  });
});
