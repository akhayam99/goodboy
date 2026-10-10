// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async () => new Promise<never>(() => undefined)),
}));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ProviderId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import {
  INITIAL_HEALTH,
  INITIAL_HEALTH_MAP,
  type ProviderHealth,
} from '../../../../store/slices/providers/providerHealth';
import { AuthRequiredCallout } from './index';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
});

type SeedParams = {
  readonly providerId: ProviderId;
  readonly health: Partial<ProviderHealth>;
};

const seedHealth = ({ providerId, health }: SeedParams) => {
  useAppStore.setState({
    providerHealth: { ...INITIAL_HEALTH_MAP, [providerId]: { ...INITIAL_HEALTH, ...health } },
  });
};

describe('AuthRequiredCallout', () => {
  it('names the provider that refused the run when it is signed out', () => {
    seedHealth({ providerId: 'anthropic', health: { standing: 'signed_out' } });
    render(<AuthRequiredCallout providerId="anthropic" onRefresh={() => undefined} />);
    expect(screen.getByText('Claude refused this run')).toBeDefined();
  });

  it('shows the last known identity when provided', () => {
    seedHealth({ providerId: 'cursor', health: { standing: 'signed_out' } });
    render(
      <AuthRequiredCallout providerId="cursor" identity="amin@x.io" onRefresh={() => undefined} />,
    );
    expect(screen.getByText(/last known identity: amin@x\.io/i)).toBeDefined();
  });

  it('opens the provider login step inline when Sign in again is clicked', () => {
    const handler = vi.fn();
    window.addEventListener('goodboy:open-settings', handler);
    seedHealth({ providerId: 'codex', health: { standing: 'signed_out' } });
    render(<AuthRequiredCallout providerId="codex" onRefresh={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign in again' }));
    window.removeEventListener('goodboy:open-settings', handler);
    expect(screen.getByText(/Connect codex/i)).toBeDefined();
    expect(handler).not.toHaveBeenCalled();
  });

  it('has no Refresh status button any more', () => {
    seedHealth({ providerId: 'anthropic', health: { standing: 'signed_out' } });
    render(<AuthRequiredCallout providerId="anthropic" onRefresh={() => undefined} />);
    expect(screen.queryByRole('button', { name: /refresh status/i })).toBeNull();
  });

  it('shows the card when the breaker is open though the probe says connected', () => {
    seedHealth({
      providerId: 'cursor',
      health: { standing: 'connected', isBreakerOpen: true, refusals: [1, 2, 3] },
    });
    render(<AuthRequiredCallout providerId="cursor" onRefresh={() => undefined} />);
    expect(screen.getByText('Cursor refused this run')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Sign in again' })).toBeDefined();
  });

  it('keeps the card away from a provider that is connected with a closed breaker', () => {
    seedHealth({ providerId: 'cursor', health: { standing: 'connected' } });
    render(<AuthRequiredCallout providerId="cursor" onRefresh={() => undefined} />);
    expect(screen.queryByRole('button', { name: 'Sign in again' })).toBeNull();
  });
});
