// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cursorMaxModeAdvisory } from '../../../shared/lib/cursorMaxModeAdvisory';
import { STORAGE_PREFIXES } from '../../../shared/lib/storage-keys';
import { refreshProviders } from './refreshProviders';
import { IDLE_CONNECT, INITIAL_CONNECT_MAP } from './types';

const providerMocks = vi.hoisted(() => {
  const status = {
    id: 'provider',
    binary: 'binary',
    available: true,
    version: '1.0.0',
    error: null,
  };
  return {
    status,
    buildProviderList: vi.fn(
      (_statuses: unknown, _authResults: unknown, _credentialProviderIds: unknown) => [],
    ),
    checkProviderAuth: vi.fn(async (): Promise<{ state: string; identity: string | null }> => ({
      state: 'unknown',
      identity: null,
    })),
    refreshProviderDetection: vi.fn(async () => status),
  };
});

vi.mock('../../../features/providers/providers', () => providerMocks);

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('refreshProviders', () => {
  it('fetches both new statuses and passes stored credentials to provider assembly', async () => {
    const set = vi.fn();
    const get = vi.fn(() => ({
      providerCredentials: [{ providerId: 'openrouter' }],
      providerConnect: INITIAL_CONNECT_MAP,
    }));
    await refreshProviders(set as never, get as never)();
    expect(providerMocks.refreshProviderDetection).toHaveBeenCalledTimes(5);
    expect(providerMocks.refreshProviderDetection).toHaveBeenCalledWith({ id: 'opencode' });
    expect(providerMocks.refreshProviderDetection).not.toHaveBeenCalledWith({ id: 'openrouter' });
    expect(providerMocks.checkProviderAuth).toHaveBeenCalledWith('opencode');
    expect(providerMocks.checkProviderAuth).toHaveBeenCalledWith('openrouter');
    expect(providerMocks.buildProviderList.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        opencode: providerMocks.status,
        openrouter: { ...providerMocks.status, id: 'openrouter' },
      }),
    );
    expect(providerMocks.buildProviderList.mock.calls[0]?.[2]).toEqual(new Set(['openrouter']));
  });

  it('drops a connect state that still claims success once auth reports disconnected', async () => {
    providerMocks.checkProviderAuth.mockImplementation(async () => ({
      state: 'disconnected',
      identity: null,
    }));
    const set = vi.fn();
    const get = vi.fn(() => ({
      providerCredentials: [],
      providerConnect: {
        ...INITIAL_CONNECT_MAP,
        cursor: { ...IDLE_CONNECT, phase: 'success', identity: 'dev@example.com' },
      },
    }));
    await refreshProviders(set as never, get as never)();
    const patch = set.mock.calls[0]?.[0] as { providerConnect: typeof INITIAL_CONNECT_MAP };
    expect(patch.providerConnect.cursor).toEqual(IDLE_CONNECT);
  });

  it('leaves a connect state alone while auth still reports connected', async () => {
    providerMocks.checkProviderAuth.mockImplementation(async () => ({
      state: 'connected',
      identity: null,
    }));
    const set = vi.fn();
    const connected = { ...IDLE_CONNECT, phase: 'success' as const, identity: 'dev@example.com' };
    const get = vi.fn(() => ({
      providerCredentials: [],
      providerConnect: { ...INITIAL_CONNECT_MAP, cursor: connected },
    }));
    await refreshProviders(set as never, get as never)();
    const patch = set.mock.calls[0]?.[0] as { providerConnect: typeof INITIAL_CONNECT_MAP };
    expect(patch.providerConnect.cursor).toEqual(connected);
  });

  it('keeps every cursor max mode key on the first refresh after a cold start', async () => {
    const key = STORAGE_PREFIXES.cursorMaxMode + 'someone%40example.com:composer-1';
    localStorage.setItem(key, '1');
    const clearAll = vi.spyOn(cursorMaxModeAdvisory, 'clearAll');
    providerMocks.checkProviderAuth.mockResolvedValue({
      state: 'connected',
      identity: 'someone@example.com',
    });
    const get = vi.fn(() => ({
      authResults: null,
      providerCredentials: [],
      providerConnect: INITIAL_CONNECT_MAP,
    }));
    const set = vi.fn();

    await refreshProviders(set as never, get as never)();

    expect(clearAll).not.toHaveBeenCalled();
    expect(localStorage.getItem(key)).toBe('1');
    clearAll.mockRestore();
  });

  it('still clears the cursor max mode keys when a known identity changes', async () => {
    const key = STORAGE_PREFIXES.cursorMaxMode + 'someone%40example.com:composer-1';
    localStorage.setItem(key, '1');
    const clearAll = vi.spyOn(cursorMaxModeAdvisory, 'clearAll');
    providerMocks.checkProviderAuth.mockResolvedValue({
      state: 'connected',
      identity: 'someone@example.com',
    });
    const get = vi.fn(() => ({
      authResults: {
        cursor: { state: 'connected', identity: 'previous@example.com' },
      },
      providerCredentials: [],
      providerConnect: INITIAL_CONNECT_MAP,
    }));
    const set = vi.fn();

    await refreshProviders(set as never, get as never)();

    expect(clearAll).toHaveBeenCalledOnce();
    expect(localStorage.getItem(key)).toBeNull();
    clearAll.mockRestore();
  });
});
