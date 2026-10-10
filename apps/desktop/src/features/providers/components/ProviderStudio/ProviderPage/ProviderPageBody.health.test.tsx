// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../ProviderCredentialsSection', () => ({
  ProviderCredentialsSection: () => null,
}));
vi.mock('./UsageGroup', () => ({
  UsageGroup: ({ providerId }: { readonly providerId: string }) => (
    <section aria-label={`Usage for ${providerId}`} />
  ),
}));
vi.mock('./ModelsGroup', () => ({
  ModelsGroup: () => <section aria-label="Models in the picker" />,
}));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ProviderId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import {
  INITIAL_EVIDENCE,
  INITIAL_HEALTH,
  INITIAL_HEALTH_MAP,
  type ProviderHealth,
} from '../../../../../store/slices/providers/providerHealth';
import type { ProviderDisplayInfo } from '../../../providers';
import { ProviderPage } from './index';

let useAppStore: StoryStore;

const NOW = Date.parse('2026-10-10T10:00:00Z');
const TWO_MINUTES = 2 * 60_000;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

type InfoParams = {
  readonly id?: ProviderId;
  readonly label?: string;
  readonly connection: ProviderDisplayInfo['connection'];
};

const info = ({
  id = 'cursor',
  label = 'Cursor',
  connection,
}: InfoParams): ProviderDisplayInfo => ({
  id,
  label,
  binary: 'cursor-agent',
  version: '1.0.0',
  connection,
  identity: 'ada@harborline.dev',
  error: null,
  docsUrl: 'https://docs.cursor.com',
  capabilities: { models: [], supportsTools: true, supportsStream: true, supportsCheapModel: true },
});

type SeedParams = {
  readonly health: Partial<ProviderHealth>;
  readonly refresh?: () => Promise<void>;
};

const seed = ({ health, refresh }: SeedParams) => {
  useAppStore.setState({
    providerHealth: { ...INITIAL_HEALTH_MAP, cursor: { ...INITIAL_HEALTH, ...health } },
    authResults: { cursor: { state: 'connected', identity: 'ada@harborline.dev' } },
    ...(refresh !== undefined && { refreshProviders: refresh }),
  });
};

const GOOD_TWO_MINUTES_AGO = {
  ...INITIAL_EVIDENCE,
  serverAccepted: true,
  localTokens: true,
  lastGoodAt: NOW - TWO_MINUTES,
};

describe('a provider that cannot be checked', () => {
  it('keeps Usage and Models visible and says what it last knew', () => {
    seed({ health: { standing: 'cannot_check', evidence: GOOD_TWO_MINUTES_AGO } });
    render(
      <ProviderPage
        info={info({ connection: 'connected' })}
        autoConnect={false}
        autoUpdate={false}
      />,
    );
    expect(screen.getByRole('region', { name: 'Usage for cursor' })).toBeDefined();
    expect(screen.getByRole('region', { name: 'Models in the picker' })).toBeDefined();
    expect(screen.getByText("Can't reach Cursor right now")).toBeDefined();
    expect(screen.getByText('Showing what we last knew, from 2m ago.')).toBeDefined();
  });

  it('keeps Usage visible even when nothing was ever confirmed', () => {
    seed({ health: { standing: 'cannot_check' } });
    render(
      <ProviderPage
        info={info({ connection: 'cannot_check' })}
        autoConnect={false}
        autoUpdate={false}
      />,
    );
    expect(screen.getByRole('region', { name: 'Usage for cursor' })).toBeDefined();
    expect(screen.queryByText('Not signed in')).toBeNull();
  });

  it('checks again from the notice', () => {
    const refresh = vi.fn(async () => undefined);
    seed({ health: { standing: 'cannot_check', evidence: GOOD_TWO_MINUTES_AGO }, refresh });
    render(
      <ProviderPage
        info={info({ connection: 'connected' })}
        autoConnect={false}
        autoUpdate={false}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Check again' }));
    expect(refresh).toHaveBeenCalledOnce();
  });
});

describe('a provider that refuses runs while its probe says connected', () => {
  const refusals = [NOW - 3 * 60_000, NOW - 2 * 60_000, NOW - 60_000];

  it('shows the breaker notice with Sign in again and the raw message under Details', () => {
    seed({
      health: {
        standing: 'connected',
        evidence: GOOD_TWO_MINUTES_AGO,
        isBreakerOpen: true,
        refusals,
        lastRefusal: 'Authentication required: run cursor-agent login',
      },
    });
    render(
      <ProviderPage
        info={info({ connection: 'connected' })}
        autoConnect={false}
        autoUpdate={false}
      />,
    );
    expect(screen.getByText('Cursor refused your last 3 runs')).toBeDefined();
    expect(
      screen.getByText(
        'Cursor says you are signed in on this Mac, but it did not accept the runs.',
      ),
    ).toBeDefined();
    expect(
      within(screen.getByRole('alert')).getByRole('button', { name: 'Sign in again' }),
    ).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Details' }));
    expect(screen.getByText('Authentication required: run cursor-agent login')).toBeDefined();
    expect(screen.getByRole('region', { name: 'Usage for cursor' })).toBeDefined();
  });

  it('shows no breaker notice once the breaker is closed', () => {
    seed({ health: { standing: 'connected', evidence: GOOD_TWO_MINUTES_AGO } });
    render(
      <ProviderPage
        info={info({ connection: 'connected' })}
        autoConnect={false}
        autoUpdate={false}
      />,
    );
    expect(screen.queryByText(/refused your last/)).toBeNull();
  });
});

describe('the page meta', () => {
  it('says the sign-in is local when the server never confirmed it', () => {
    seed({
      health: {
        standing: 'connected',
        evidence: { ...GOOD_TWO_MINUTES_AGO, serverAccepted: false },
      },
    });
    render(
      <ProviderPage
        info={info({ connection: 'connected' })}
        autoConnect={false}
        autoUpdate={false}
      />,
    );
    expect(screen.getByText(/Signed in on this Mac\. Not confirmed by Cursor\./)).toBeDefined();
  });

  it('says who is signed in and when the server last confirmed it', () => {
    seed({ health: { standing: 'connected', evidence: GOOD_TWO_MINUTES_AGO } });
    render(
      <ProviderPage
        info={info({ connection: 'connected' })}
        autoConnect={false}
        autoUpdate={false}
      />,
    );
    expect(screen.getByText(/Signed in as ada@harborline\.dev\. Confirmed 2m ago/)).toBeDefined();
  });
});
