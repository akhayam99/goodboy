import { beforeEach, describe, expect, it, vi } from 'vitest';
import { refreshProviders } from './refreshProviders';

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
    checkProviderAuth: vi.fn(async () => ({ state: 'unknown', identity: null })),
    getProviderStatus: vi.fn(async () => status),
    getCursorStatus: vi.fn(async () => status),
    getCodexStatus: vi.fn(async () => status),
    getGeminiStatus: vi.fn(async () => status),
    getOpenCodeStatus: vi.fn(async () => status),
    getOpenRouterStatus: vi.fn(async () => status),
  };
});

vi.mock('../../../features/providers/providers', () => providerMocks);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('refreshProviders', () => {
  it('fetches both new statuses and passes stored credentials to provider assembly', async () => {
    const set = vi.fn();
    const get = vi.fn(() => ({
      providerCredentials: [{ providerId: 'openrouter' }],
    }));
    await refreshProviders(set as never, get as never)();
    expect(providerMocks.getOpenCodeStatus).toHaveBeenCalledOnce();
    expect(providerMocks.getOpenRouterStatus).toHaveBeenCalledOnce();
    expect(providerMocks.checkProviderAuth).toHaveBeenCalledWith('opencode');
    expect(providerMocks.checkProviderAuth).toHaveBeenCalledWith('openrouter');
    expect(providerMocks.buildProviderList.mock.calls[0]?.[2]).toEqual(new Set(['openrouter']));
  });
});
