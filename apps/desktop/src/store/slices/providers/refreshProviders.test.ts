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
    refreshProviderDetection: vi.fn(async () => status),
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
});
