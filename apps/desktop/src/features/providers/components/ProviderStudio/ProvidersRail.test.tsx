// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async () => new Promise<never>(() => undefined)),
}));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { IsoDateTime, ProviderId, ProviderLimits } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import type { ProviderDisplayInfo } from '../../providers';
import { ProvidersRail } from './ProvidersRail';

let useAppStore: StoryStore;

const NOW = new Date(2026, 8, 25, 12, 0).getTime();

const iso = (hours: number): IsoDateTime =>
  new Date(2026, 8, 25, hours, 0).toISOString() as IsoDateTime;

const provider = ({
  id,
  label,
  connection,
}: {
  readonly id: ProviderId;
  readonly label: string;
  readonly connection: ProviderDisplayInfo['connection'];
}): ProviderDisplayInfo => ({
  id,
  binary: id,
  capabilities: { models: [], supportsTools: true, supportsStream: true, supportsCheapModel: true },
  connection,
  version: '99.0.0',
  identity: null,
  label,
  error: null,
  docsUrl: '',
});

const PROVIDERS: ReadonlyArray<ProviderDisplayInfo> = [
  provider({ id: 'anthropic', label: 'Claude', connection: 'connected' }),
  provider({ id: 'cursor', label: 'Cursor', connection: 'connected' }),
  provider({ id: 'codex', label: 'Codex', connection: 'connected' }),
  provider({ id: 'gemini', label: 'Gemini', connection: 'installed_disconnected' }),
];

const LOW: ProviderLimits = {
  providerId: 'anthropic',
  plan: null,
  status: 'warning',
  windows: [
    { kind: 'fiveHour', model: null, status: 'warning', usedFraction: 0.9, resetsAt: iso(14) },
  ],
  observedAt: iso(11),
};

const OUT: ProviderLimits = {
  providerId: 'codex',
  plan: null,
  status: 'reached',
  windows: [{ kind: 'weekly', model: null, status: 'reached', usedFraction: 1, resetsAt: iso(18) }],
  observedAt: iso(11),
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const mount = ({
  onSelect = vi.fn(),
  onSelectDefaults = vi.fn(),
}: {
  readonly onSelect?: (id: ProviderId) => void;
  readonly onSelectDefaults?: () => void;
} = {}) =>
  render(
    <ProvidersRail
      providers={PROVIDERS}
      focusedId="anthropic"
      onSelect={onSelect}
      onSelectDefaults={onSelectDefaults}
    />,
  );

describe('ProvidersRail', () => {
  it('lists Models and each provider as one line of text', () => {
    mount();
    const list = screen.getByRole('list', { name: 'Providers & models settings' });

    expect(
      within(list)
        .getAllByRole('button')
        .map((row) => row.textContent),
    ).toEqual(['Models', 'Claude', 'Cursor', 'Codex', 'Gemini']);
  });

  it('marks the focused provider as the current page', () => {
    mount();

    expect(screen.getByRole('button', { name: 'Claude' }).getAttribute('aria-current')).toBe(
      'true',
    );
    expect(screen.getByRole('button', { name: 'Cursor' }).getAttribute('aria-current')).toBe(
      'false',
    );
  });

  it('puts a labelled dot at the end of a provider that is about to run out or out', () => {
    useAppStore.setState({ providerLimits: { anthropic: LOW, codex: OUT } });
    mount();

    expect(
      within(screen.getByRole('button', { name: /^Claude/ })).getByRole('img', {
        name: 'Claude is about to run out',
      }),
    ).toBeDefined();
    expect(
      within(screen.getByRole('button', { name: /^Codex/ })).getByRole('img', {
        name: 'Codex is out',
      }),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: /^Claude/ }).textContent).toBe('Claude');
  });

  it('says what is wrong with a provider that is not signed in, and nothing for a quiet one', () => {
    mount();

    expect(
      within(screen.getByRole('button', { name: /^Gemini/ })).getByRole('img', {
        name: 'Not signed in',
      }),
    ).toBeDefined();
    expect(within(screen.getByRole('button', { name: 'Cursor' })).queryByRole('img')).toBeNull();
  });

  it('opens a provider and the models page from their rows', () => {
    const onSelect = vi.fn();
    const onSelectDefaults = vi.fn();
    mount({ onSelect, onSelectDefaults });

    fireEvent.click(screen.getByRole('button', { name: 'Cursor' }));
    fireEvent.click(screen.getByRole('button', { name: 'Models' }));

    expect(onSelect).toHaveBeenCalledWith('cursor');
    expect(onSelectDefaults).toHaveBeenCalledOnce();
  });
});
