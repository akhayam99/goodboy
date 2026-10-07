// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async () => new Promise<never>(() => undefined)),
}));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { IsoDateTime, ProviderId, ProviderLimits } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import type { ProviderDisplayInfo } from '../../../providers';
import { ProviderAttentionNotice } from './ProviderAttentionNotice';

let useAppStore: StoryStore;

const connected = ({ id }: { readonly id: ProviderId }): ProviderDisplayInfo => ({
  id,
  binary: id,
  capabilities: { models: [], supportsTools: true, supportsStream: true, supportsCheapModel: true },
  connection: 'connected',
  version: '99.0.0',
  identity: null,
  label: id,
  error: null,
  docsUrl: '',
});

const NOW = new Date(2026, 8, 25, 12, 0).getTime();

const localIso = (hours: number, minutes: number, dayOffset = 0): IsoDateTime =>
  new Date(2026, 8, 25 + dayOffset, hours, minutes).toISOString() as IsoDateTime;

const CLAUDE_LOW: ProviderLimits = {
  providerId: 'anthropic',
  plan: null,
  status: 'warning',
  windows: [
    {
      kind: 'fiveHour',
      model: null,
      status: 'warning',
      usedFraction: 0.82,
      resetsAt: localIso(14, 30),
    },
  ],
  observedAt: localIso(11, 57),
};

const CODEX_OUT: ProviderLimits = {
  providerId: 'codex',
  plan: 'Plus',
  status: 'reached',
  windows: [
    {
      kind: 'weekly',
      model: null,
      status: 'reached',
      usedFraction: 1,
      resetsAt: localIso(18, 12, 6),
    },
  ],
  observedAt: localIso(11, 48),
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

describe('ProviderAttentionNotice', () => {
  it('says a provider is about to run out, with when its window resets', () => {
    useAppStore.setState({ providerLimits: { anthropic: CLAUDE_LOW } });
    render(<ProviderAttentionNotice providerId="anthropic" />);

    screen.getByText('Claude is about to run out.');
    screen.getByText('The 5-hour window resets at 14:30.');
    expect(document.querySelector('[data-tone="warning"][data-placement="inline"]')).not.toBeNull();
  });

  it('says a provider is out, with the day it comes back', () => {
    useAppStore.setState({ providerLimits: { codex: CODEX_OUT } });
    render(<ProviderAttentionNotice providerId="codex" />);

    screen.getByText('Codex is out for the week.');
    expect(document.querySelector('[data-tone="danger"]')).not.toBeNull();
    expect(screen.queryByText(/Auto routes new agents/)).toBeNull();
  });

  it('says where Auto sends new agents only when the ladder really skips the provider', () => {
    useAppStore.setState({
      providers: [connected({ id: 'codex' }), connected({ id: 'anthropic' })],
      providerLimits: { codex: CODEX_OUT },
    });
    render(<ProviderAttentionNotice providerId="codex" />);

    screen.getByText(/Auto routes new agents to Claude until then\.$/);
  });

  it('stays out of the way for a quiet provider and for the states that only inform', () => {
    const quiet = render(<ProviderAttentionNotice providerId="anthropic" />);
    expect(quiet.container.textContent).toBe('');
    quiet.unmount();

    const informed = render(<ProviderAttentionNotice providerId="cursor" />);
    expect(informed.container.textContent).toBe('');
  });
});
