vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  stubStoryInvoke,
  type StoryStore,
} from '../../storyHarness';
import { providerRailStatus } from '../../../features/providers/providerRailStatus';
import { cursorMaxModeAdvisory } from '../../../shared/lib/cursorMaxModeAdvisory';
import { STORAGE_PREFIXES } from '../../../shared/lib/storage-keys';
import { applyProviderProbe, takeProbeSeq } from './applyProviderProbe';
import { IDLE_CONNECT } from './types';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

type AuthAnswer = {
  readonly state: 'connected' | 'disconnected' | 'unknown';
  readonly identity: string | null;
  readonly verified?: boolean;
};

type Script = {
  cursorAuth: () => Promise<AuthAnswer> | AuthAnswer;
  cursorStatus: () => Record<string, unknown>;
};

const okStatus = (id: string) => ({
  id,
  binary: id,
  available: true,
  version: '1.0.0',
  error: null,
});

const CONNECTED: AuthAnswer = {
  state: 'connected',
  identity: 'ada@harborline.dev',
  verified: true,
};
const SIGNED_OUT: AuthAnswer = { state: 'disconnected', identity: null };
const UNKNOWN: AuthAnswer = { state: 'unknown', identity: null };
const TIMED_OUT = {
  id: 'cursor',
  binary: 'cursor-agent',
  available: false,
  version: null,
  error: 'timed out',
  errorKind: 'timeout',
};

let script: Script;

const callsTo = (command: string): number =>
  storySpies.tauriInvoke.mock.calls.filter(([name]) => name === command).length;

const install = () => {
  stubStoryInvoke({
    refresh_provider_status: () => okStatus('anthropic'),
    refresh_cursor_status: () => script.cursorStatus(),
    refresh_codex_status: () => okStatus('codex'),
    refresh_gemini_status: () => okStatus('gemini'),
    refresh_opencode_status: () => okStatus('opencode'),
    check_provider_auth: (args: unknown) => {
      const providerId = (args as { readonly providerId: string }).providerId;
      return providerId === 'cursor' ? script.cursorAuth() : CONNECTED;
    },
    log_provider_standing: null,
  });
};

const cursorInfo = () => useAppStore.getState().providers.find((p) => p.id === 'cursor');

const cursorRail = () => {
  const state = useAppStore.getState();
  const provider = cursorInfo();
  if (provider === undefined) {
    throw new Error('cursor missing from the provider list');
  }
  return providerRailStatus({ provider, state });
};

beforeEach(async () => {
  await resetStoryStore();
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
  vi.setSystemTime(new Date('2026-10-10T10:00:00Z'));
  script = {
    cursorAuth: () => CONNECTED,
    cursorStatus: () => okStatus('cursor'),
  };
  install();
});

afterEach(() => {
  vi.useRealTimers();
});

const refresh = () => useAppStore.getState().refreshProviders();

const advance = (ms: number) => {
  vi.setSystemTime(Date.now() + ms);
};

describe('refreshProviders', () => {
  it('runs one probe set for two overlapping refreshes', async () => {
    const first = refresh();
    const second = refresh();
    await Promise.all([first, second]);
    expect(callsTo('refresh_cursor_status')).toBe(1);
    expect(callsTo('check_provider_auth')).toBe(7);
  });

  it('queues exactly one more probe set for fresh requests made during a run', async () => {
    const running = refresh();
    const fresh = [
      useAppStore.getState().refreshProviders({ isFresh: true }),
      useAppStore.getState().refreshProviders({ isFresh: true }),
    ];
    await Promise.all([running, ...fresh]);
    expect(callsTo('refresh_cursor_status')).toBe(2);
  });

  it('starts a new probe set once the previous one has finished', async () => {
    await refresh();
    await refresh();
    expect(callsTo('refresh_cursor_status')).toBe(2);
  });

  it('never lets an older result overwrite a newer one', async () => {
    let release: (answer: AuthAnswer) => void = () => undefined;
    script.cursorAuth = () =>
      new Promise<AuthAnswer>((resolve) => {
        release = resolve;
      });
    const slow = refresh();
    await vi.waitFor(() => expect(callsTo('check_provider_auth')).toBeGreaterThan(0));
    const state = useAppStore.getState();
    applyProviderProbe({
      set: useAppStore.setState,
      get: useAppStore.getState,
      seq: takeProbeSeq(),
      statuses: {
        anthropic: okStatus('anthropic'),
        cursor: okStatus('cursor'),
        codex: okStatus('codex'),
        gemini: okStatus('gemini'),
        opencode: okStatus('opencode'),
        openrouter: okStatus('openrouter'),
        moonshot: okStatus('moonshot'),
      },
      authResults: { ...state.authResults, cursor: CONNECTED },
    });
    release(SIGNED_OUT);
    await slow;
    expect(cursorInfo()?.connection).toBe('connected');
    expect(useAppStore.getState().authResults?.cursor?.state).toBe('connected');
  });
});

describe('a provider that stops answering', () => {
  it('keeps a connected provider connected through one timed out probe', async () => {
    await refresh();
    script.cursorStatus = () => TIMED_OUT;
    await refresh();
    expect(cursorInfo()?.connection).toBe('connected');
    expect(cursorRail()).toEqual({ subtitle: undefined, tone: undefined });
  });

  it('never reads a timeout as not installed or not signed in', async () => {
    script.cursorStatus = () => TIMED_OUT;
    await refresh();
    expect(cursorInfo()?.connection).toBe('unknown');
    expect(cursorRail().subtitle).toBeUndefined();
  });

  it('never reads an unrecognised auth answer as not signed in', async () => {
    await refresh();
    script.cursorAuth = () => UNKNOWN;
    await refresh();
    expect(cursorInfo()?.connection).toBe('connected');
    expect(cursorRail().subtitle).not.toBe('Not signed in');
    expect(cursorRail().subtitle).not.toBe('Signed out');
  });

  it('says Can not check after three silent probes in ten minutes and keeps the last good state', async () => {
    await refresh();
    script.cursorAuth = () => UNKNOWN;
    await refresh();
    advance(60_000);
    await refresh();
    expect(cursorRail().subtitle).toBeUndefined();
    advance(60_000);
    await refresh();
    expect(useAppStore.getState().providerHealth.cursor.standing).toBe('cannot_check');
    expect(cursorInfo()?.connection).toBe('connected');
    expect(cursorRail()).toEqual({ subtitle: "Can't check", tone: 'neutral' });
  });

  it('clears Can not check as soon as the provider answers again', async () => {
    await refresh();
    script.cursorAuth = () => UNKNOWN;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      advance(30_000);
      await refresh();
    }
    script.cursorAuth = () => CONNECTED;
    await refresh();
    expect(useAppStore.getState().providerHealth.cursor.standing).toBe('connected');
    expect(cursorRail().subtitle).toBeUndefined();
  });
});

describe('signing out', () => {
  it('waits for a second not logged in answer ten seconds later', async () => {
    await refresh();
    script.cursorAuth = () => SIGNED_OUT;
    await refresh();
    expect(cursorInfo()?.connection).toBe('connected');
    advance(11_000);
    await refresh();
    expect(cursorInfo()?.connection).toBe('installed_disconnected');
    expect(cursorRail()).toEqual({ subtitle: 'Signed out', tone: 'warning' });
  });

  it('asks again by itself a few seconds after a first not logged in answer', async () => {
    await refresh();
    script.cursorAuth = () => SIGNED_OUT;
    await refresh();
    expect(cursorInfo()?.connection).toBe('connected');
    await vi.advanceTimersByTimeAsync(12_000);
    await vi.advanceTimersByTimeAsync(0);
    expect(cursorInfo()?.connection).toBe('installed_disconnected');
  });

  it('says Not confirmed for local tokens that the server never vouched for', async () => {
    script.cursorAuth = () => ({ state: 'connected', identity: null, verified: false });
    await refresh();
    expect(cursorRail()).toEqual({ subtitle: 'Not confirmed', tone: 'neutral' });
  });
});

describe('cursor max mode advisory', () => {
  const key = STORAGE_PREFIXES.cursorMaxMode + 'someone%40example.com:composer-1';

  it('keeps every key on the first refresh after a cold start', async () => {
    localStorage.setItem(key, '1');
    const clearAll = vi.spyOn(cursorMaxModeAdvisory, 'clearAll');
    script.cursorAuth = () => ({ state: 'connected', identity: 'someone@example.com' });
    await refresh();
    expect(clearAll).not.toHaveBeenCalled();
    expect(localStorage.getItem(key)).toBe('1');
    clearAll.mockRestore();
  });

  it('still clears the keys when a known identity changes', async () => {
    script.cursorAuth = () => ({ state: 'connected', identity: 'previous@example.com' });
    await refresh();
    localStorage.setItem(key, '1');
    const clearAll = vi.spyOn(cursorMaxModeAdvisory, 'clearAll');
    script.cursorAuth = () => ({ state: 'connected', identity: 'someone@example.com' });
    await refresh();
    expect(clearAll).toHaveBeenCalledOnce();
    expect(localStorage.getItem(key)).toBeNull();
    clearAll.mockRestore();
  });
});

describe('what the refresh keeps assembling', () => {
  it('probes the opencode runtime once and shares it with OpenRouter and Moonshot', async () => {
    await refresh();
    expect(callsTo('refresh_opencode_status')).toBe(1);
    expect(callsTo('refresh_openrouter_status')).toBe(0);
    expect(callsTo('check_provider_auth')).toBe(7);
  });

  it('links OpenRouter from its stored credential', async () => {
    useAppStore.setState({
      providerCredentials: [{ providerId: 'openrouter' }] as never,
    });
    await refresh();
    const providers = useAppStore.getState().providers;
    expect(providers.find((provider) => provider.id === 'openrouter')?.connection).toBe(
      'connected',
    );
    expect(providers.find((provider) => provider.id === 'moonshot')?.connection).toBe(
      'installed_disconnected',
    );
  });

  it('drops a connect state that still claims success once auth reports signed out', async () => {
    useAppStore.setState({
      providerConnect: {
        ...useAppStore.getState().providerConnect,
        cursor: { ...IDLE_CONNECT, phase: 'success', identity: 'dev@example.com' },
      },
    });
    script.cursorAuth = () => SIGNED_OUT;
    await refresh();
    expect(useAppStore.getState().providerConnect.cursor).toEqual(IDLE_CONNECT);
  });

  it('leaves a connect state alone while auth still reports connected', async () => {
    const connected = { ...IDLE_CONNECT, phase: 'success' as const, identity: 'dev@example.com' };
    useAppStore.setState({
      providerConnect: { ...useAppStore.getState().providerConnect, cursor: connected },
    });
    await refresh();
    expect(useAppStore.getState().providerConnect.cursor).toEqual(connected);
  });
});

describe('the standing log', () => {
  it('logs one line for each standing change and none for an unchanged probe', async () => {
    await refresh();
    const first = callsTo('log_provider_standing');
    await refresh();
    expect(first).toBeGreaterThan(0);
    expect(callsTo('log_provider_standing')).toBe(first);
  });
});
